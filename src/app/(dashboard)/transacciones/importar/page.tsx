'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileUp, Loader2, CheckCircle2, AlertCircle, X,
  ChevronDown, ChevronUp, Edit2, Trash2, Save, Check, ChevronsUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import Decimal from 'decimal.js'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import TransactionDialog from '@/components/transactions/TransactionDialog'
import type { ParsedTransaction } from '@/components/transactions/PDFUploader'
import type { Database } from '@/types/database.types'

// ── Types ──────────────────────────────────────────────────────────────────
type TxType   = Database['public']['Enums']['transaction_type']
type Currency = Database['public']['Enums']['currency']

interface Portfolio {
  id:             string
  name:           string
  custodian_name: string
  client_name:    string
  client_id:      string
}

type Asset = Pick<
  Database['public']['Tables']['assets']['Row'],
  'id' | 'ticker' | 'name' | 'current_residual_factor'
>

type ImportStatus = 'pending' | 'saving' | 'saved' | 'discarded' | 'error'

interface FXLookup {
  mep:      number | null
  ccl:      number | null
  typeUsed: 'MEP' | 'CCL'
  exact:    boolean
  warning:  string | null
  rateDate: string | null
}

interface ImportItem {
  id:            string
  fileName:      string
  parsed:        ParsedTransaction
  status:        ImportStatus
  error?:        string
  matchedAsset?: Asset | null
  fxLoading?:   boolean
  fxLookup?:    FXLookup | null
  fxRateMep?:   string
  fxRateCcl?:   string
}

// ── Helpers ────────────────────────────────────────────────────────────────
const TX_TYPE_LABELS: Partial<Record<TxType, string>> = {
  COMPRA: 'Compra', VENTA: 'Venta',
  SUSCRIPCION_FCI: 'Suscripción FCI', RESCATE_FCI: 'Rescate FCI',
  RENTA: 'Renta', DIVIDENDO: 'Dividendo', AMORTIZACION: 'Amortización',
  DEPOSITO: 'Depósito', RETIRO: 'Retiro',
}

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface FXLookupResponse {
  recommended: {
    type:      'MEP' | 'CCL'
    rate:      number | null
    rate_date: string | null
    exact:     boolean
    warning:   string | null
  }
  reference: {
    type:      'MEP' | 'CCL'
    rate:      number | null
    rate_date: string | null
  }
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ImportarBoletosPage() {
  const [portfolios, setPortfolios]               = useState<Portfolio[]>([])
  const [assets, setAssets]                       = useState<Asset[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>('')
  const [queue, setQueue]                         = useState<ImportItem[]>([])
  const [processingIds, setProcessingIds]         = useState<Set<string>>(new Set())
  const [editItem, setEditItem]                   = useState<ImportItem | null>(null)
  const [expandedId, setExpandedId]               = useState<string | null>(null)

  // Load portfolios (with client name) + assets on mount
  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('portfolios')
      .select('id, name, custodian_name, clients(id, full_name)')
      .eq('is_active', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => {
        const rows = ((data ?? []) as any[]).map(p => ({
          id:             p.id as string,
          name:           p.name as string,
          custodian_name: p.custodian_name as string,
          client_name:    (p.clients as { full_name: string } | null)?.full_name ?? '',
          client_id:      (p.clients as { id: string } | null)?.id ?? '',
        }))
        rows.sort((a, b) => {
          const c = a.client_name.localeCompare(b.client_name, 'es')
          return c !== 0 ? c : a.name.localeCompare(b.name, 'es')
        })
        setPortfolios(rows)
      })

    supabase
      .from('assets')
      .select('id, ticker, name, current_residual_factor')
      .eq('is_active', true)
      .order('ticker')
      .then(({ data }) => setAssets(data ?? []))
  }, [])

  // Process a single PDF file — parse + FX lookup
  const processFile = useCallback(async (file: File) => {
    const itemId = crypto.randomUUID()
    setProcessingIds(prev => new Set(prev).add(itemId))
    setQueue(prev => [{
      id: itemId, fileName: file.name,
      parsed: {} as ParsedTransaction,
      status: 'pending', matchedAsset: undefined, fxLoading: false,
    }, ...prev])

    const fd = new FormData()
    fd.append('pdf', file)

    try {
      // Step A: parse PDF
      const res  = await fetch('/api/transactions/parse-pdf', { method: 'POST', body: fd })
      const json = await res.json() as { data?: ParsedTransaction; error?: string }
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)

      const parsed  = json.data!
      const matched = parsed.ticker
        ? (assets.find(a => a.ticker.toUpperCase() === parsed.ticker!.toUpperCase()) ?? null)
        : null

      setQueue(prev => prev.map(it =>
        it.id === itemId
          ? { ...it, parsed, matchedAsset: matched, fxLoading: true }
          : it
      ))
      toast.success(`Boleto procesado: ${parsed.ticker ?? file.name}`)

      // Step B: FX lookup (non-fatal)
      let fxLookup: FXLookup | null = null
      let fxRateMep: string | undefined
      let fxRateCcl: string | undefined

      if (parsed.trade_date && parsed.ticker && parsed.asset_type_hint) {
        try {
          const fxRes  = await fetch('/api/fx-rates/lookup?' + new URLSearchParams({
            date:      parsed.trade_date,
            assetType: parsed.asset_type_hint,
            ticker:    parsed.ticker,
          }))
          const fxData = await fxRes.json() as FXLookupResponse

          const recMep = fxData.recommended.type === 'MEP'
            ? fxData.recommended.rate : fxData.reference.rate
          const recCcl = fxData.recommended.type === 'CCL'
            ? fxData.recommended.rate : fxData.reference.rate

          fxLookup = {
            mep:      recMep ?? null,
            ccl:      recCcl ?? null,
            typeUsed: fxData.recommended.type,
            exact:    fxData.recommended.exact,
            warning:  fxData.recommended.warning ?? null,
            rateDate: fxData.recommended.rate_date,
          }
          if (recMep != null) fxRateMep = String(recMep)
          if (recCcl != null) fxRateCcl = String(recCcl)
        } catch {
          // FX lookup failure is non-fatal
        }
      }

      setQueue(prev => prev.map(it =>
        it.id === itemId
          ? { ...it, fxLoading: false, fxLookup, fxRateMep, fxRateCcl }
          : it
      ))
    } catch (err) {
      setQueue(prev => prev.map(it =>
        it.id === itemId
          ? { ...it, status: 'error', error: err instanceof Error ? err.message : 'Error', fxLoading: false }
          : it
      ))
      toast.error(`Error procesando ${file.name}`)
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(itemId); return s })
    }
  }, [assets])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept:         { 'application/pdf': ['.pdf'] },
    onDropAccepted: files => files.forEach(processFile),
    onDropRejected: () => toast.error('Solo se aceptan archivos PDF'),
  })

  // Confirm and save an item
  async function confirmSave(item: ImportItem) {
    if (!selectedPortfolio) { toast.error('Seleccioná un portfolio'); return }
    if (!item.matchedAsset) { toast.error('Asigná el instrumento antes de confirmar'); return }

    const p = item.parsed
    const isARS = (p.currency ?? 'ARS') === 'ARS'
    if (isARS && !item.fxRateMep && !item.fxRateCcl) {
      toast.error('Ingresá el tipo de cambio (MEP o CCL) para esta operación')
      setExpandedId(item.id)
      return
    }

    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saving' } : it))

    const supabase = createClient()
    const gross  = new Decimal(p.gross_amount ?? 0)
    const fees   = new Decimal(p.alyce_commission ?? 0).plus(new Decimal(p.other_fees ?? 0))
    const txType = (p.transaction_type as TxType) ?? 'COMPRA'
    const isBuy  = ['COMPRA', 'SUSCRIPCION_FCI', 'DEPOSITO', 'TRANSFERENCIA_IN'].includes(txType)
    const net    = p.net_amount != null
      ? new Decimal(p.net_amount)
      : isBuy ? gross.plus(fees) : gross.minus(fees)

    const { error } = await supabase.from('transactions').insert({
      portfolio_id:             selectedPortfolio,
      asset_id:                 item.matchedAsset.id,
      transaction_type:         txType,
      trade_date:               p.trade_date ?? new Date().toISOString().slice(0, 10),
      settlement_date:          p.settlement_date ?? null,
      quantity:                 p.quantity ?? 0,
      price_per_unit:           p.price_per_unit ?? 0,
      gross_amount:             gross.toNumber(),
      alyce_commission:         p.alyce_commission ?? 0,
      gas_fee_amount:           0,
      other_fees:               p.other_fees ?? 0,
      net_amount:               net.toNumber(),
      currency:                 (p.currency as Currency) ?? 'ARS',
      fx_rate_mep:              item.fxRateMep ? parseFloat(item.fxRateMep) : null,
      fx_rate_ccl:              item.fxRateCcl ? parseFloat(item.fxRateCcl) : null,
      residual_factor_at_trade: item.matchedAsset.current_residual_factor ?? 1,
      notes: [
        p.custodian_name   ? `ALyC: ${p.custodian_name}`   : '',
        p.operation_number ? `Op: ${p.operation_number}`   : '',
        p.notes ?? '',
      ].filter(Boolean).join(' | ') || null,
    })

    if (error) {
      setQueue(prev => prev.map(it =>
        it.id === item.id ? { ...it, status: 'error', error: error.message } : it
      ))
      toast.error(`Error al guardar: ${error.message}`)
      return
    }

    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saved' } : it))
    toast.success(`Guardado: ${p.ticker ?? ''} ${TX_TYPE_LABELS[txType] ?? txType}`)
  }

  const activeItems  = queue.filter(it => it.status !== 'discarded')
  const pendingCount = activeItems.filter(it => it.status === 'pending').length
  const savedCount   = activeItems.filter(it => it.status === 'saved').length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Importar Boletos PDF</h1>
        <p className="text-sm text-slate-400 mt-1">
          Subí boletos de tu ALyC — Claude extrae los datos y el tipo de cambio se busca automáticamente.
        </p>
      </div>

      {/* Portfolio selector */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 space-y-2">
        <Label className="text-slate-300">Portfolio de destino *</Label>
        <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 max-w-lg">
            <SelectValue placeholder="Seleccionar portfolio..." />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
            {portfolios.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className="font-medium">{p.client_name}</span>
                <span className="text-slate-400"> — {p.name}</span>
                <span className="text-slate-500 text-xs"> ({p.custodian_name})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed',
          'px-8 py-10 text-center cursor-pointer transition-colors duration-150',
          isDragActive
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
        )}
      >
        <input {...getInputProps()} />
        <FileUp className="h-8 w-8 text-slate-500" />
        <div>
          <p className="text-slate-300 text-sm font-medium">
            {isDragActive ? 'Soltá los PDFs acá' : 'Arrastrá boletos PDF o hacé click para seleccionar'}
          </p>
          <p className="text-slate-600 text-xs mt-1">
            Podés subir múltiples PDFs a la vez · Compatible con Cocos, IOL, PPI, Balanz, BYMA
          </p>
        </div>
      </div>

      {/* Processing indicator */}
      {processingIds.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Procesando {processingIds.size} {processingIds.size === 1 ? 'PDF' : 'PDFs'} con IA…
        </div>
      )}

      {/* Session summary */}
      {activeItems.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{activeItems.length} {activeItems.length === 1 ? 'boleto' : 'boletos'} en cola</span>
          {savedCount   > 0 && <span className="text-emerald-400">{savedCount} guardados</span>}
          {pendingCount > 0 && <span className="text-amber-400">{pendingCount} pendientes</span>}
        </div>
      )}

      {/* Import queue */}
      <div className="space-y-3">
        {queue.filter(it => it.status !== 'discarded').map(item => (
          <ImportCard
            key={item.id}
            item={item}
            assets={assets}
            expanded={expandedId === item.id}
            onToggleExpand={() => setExpandedId(prev => prev === item.id ? null : item.id)}
            onMepChange={val => setQueue(prev =>
              prev.map(it => it.id === item.id ? { ...it, fxRateMep: val } : it)
            )}
            onCclChange={val => setQueue(prev =>
              prev.map(it => it.id === item.id ? { ...it, fxRateCcl: val } : it)
            )}
            onAssetChange={asset => setQueue(prev =>
              prev.map(it => it.id === item.id ? { ...it, matchedAsset: asset } : it)
            )}
            onConfirm={() => confirmSave(item)}
            onEdit={() => setEditItem(item)}
            onDiscard={() => setQueue(prev =>
              prev.map(it => it.id === item.id ? { ...it, status: 'discarded' } : it)
            )}
          />
        ))}
      </div>

      {/* TransactionDialog for editing */}
      {editItem && selectedPortfolio && (
        <TransactionDialog
          portfolioId={selectedPortfolio}
          prefill={editItem.parsed}
          open={!!editItem}
          onOpenChange={open => { if (!open) setEditItem(null) }}
          onSuccess={() => {
            setQueue(prev =>
              prev.map(it => it.id === editItem.id ? { ...it, status: 'saved' } : it)
            )
            setEditItem(null)
          }}
        />
      )}
    </div>
  )
}

// ── ImportCard ─────────────────────────────────────────────────────────────
interface ImportCardProps {
  item:           ImportItem
  assets:         Asset[]
  expanded:       boolean
  onToggleExpand: () => void
  onMepChange:    (val: string) => void
  onCclChange:    (val: string) => void
  onAssetChange:  (asset: Asset) => void
  onConfirm:      () => void
  onEdit:         () => void
  onDiscard:      () => void
}

function ImportCard({
  item, assets, expanded, onToggleExpand,
  onMepChange, onCclChange, onAssetChange, onConfirm, onEdit, onDiscard,
}: ImportCardProps) {
  const [assetComboOpen, setAssetComboOpen] = useState(false)
  const [fxEditMode, setFxEditMode]         = useState(false)

  const p       = item.parsed
  const isARS   = (p.currency ?? 'ARS') === 'ARS'
  const canSave = item.status === 'pending' && !!item.matchedAsset

  const statusColor = {
    pending:   'border-slate-700',
    saving:    'border-slate-600',
    saved:     'border-emerald-700 bg-emerald-950/10',
    discarded: 'border-slate-800 opacity-40',
    error:     'border-red-700 bg-red-950/10',
  }[item.status]

  // Still processing (skeleton)
  if (!p.trade_date && !p.ticker && item.status === 'pending') {
    return (
      <div className={cn('rounded-lg border p-4 flex items-center gap-3', statusColor)}>
        <Loader2 className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm text-slate-300 font-mono">{item.fileName}</p>
          <p className="text-xs text-slate-500">Procesando con IA…</p>
        </div>
      </div>
    )
  }

  function revertFxToLookup() {
    onMepChange(item.fxLookup?.mep != null ? String(item.fxLookup.mep) : '')
    onCclChange(item.fxLookup?.ccl != null ? String(item.fxLookup.ccl) : '')
    setFxEditMode(false)
  }

  return (
    <div className={cn('rounded-lg border transition-colors', statusColor)}>
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0 space-y-1.5">

          {/* Row 1: ticker + type + status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {p.ticker && (
              <span className="font-mono font-semibold text-emerald-400 text-sm">{p.ticker}</span>
            )}
            {p.transaction_type && (
              <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                {TX_TYPE_LABELS[p.transaction_type as TxType] ?? p.transaction_type}
              </span>
            )}
            {item.status === 'saved' && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Guardado
              </span>
            )}
            {item.status === 'error' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {item.error}
              </span>
            )}
          </div>

          {/* Row 2: amounts + ALyC */}
          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {p.trade_date     && <span>{p.trade_date}</span>}
            {p.quantity       && <span>{fmt(p.quantity)} u.</span>}
            {p.price_per_unit && <span>@ {fmt(p.price_per_unit)}</span>}
            {p.net_amount     && (
              <span className="font-mono text-slate-300">
                neto: {fmt(p.net_amount)} {p.currency ?? 'ARS'}
              </span>
            )}
            {p.custodian_name && <span className="text-slate-600">{p.custodian_name}</span>}
          </div>

          {/* Row 3: asset combobox when ticker not matched */}
          {item.status === 'pending' && !item.matchedAsset && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs text-amber-400 shrink-0">⚠ Ticker no encontrado —</span>
              <Popover open={assetComboOpen} onOpenChange={setAssetComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="h-7 text-xs bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 gap-1.5"
                  >
                    Seleccioná el instrumento
                    <ChevronsUpDown className="h-3 w-3 text-slate-500" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-slate-800 border-slate-700" align="start">
                  <Command
                    className="bg-slate-800"
                    filter={(value, search) => {
                      const asset = assets.find(a => a.id === value)
                      if (!asset) return 0
                      const q = search.toLowerCase()
                      return asset.ticker.toLowerCase().includes(q) ||
                             asset.name.toLowerCase().includes(q) ? 1 : 0
                    }}
                  >
                    <CommandInput
                      placeholder="Buscar ticker o nombre..."
                      className="border-b border-slate-700 text-slate-100 placeholder:text-slate-500"
                    />
                    <CommandList className="max-h-52">
                      <CommandEmpty className="text-slate-500 text-sm py-4 text-center">
                        Sin resultados
                      </CommandEmpty>
                      <CommandGroup>
                        {assets.map(asset => (
                          <CommandItem
                            key={asset.id}
                            value={asset.id}
                            onSelect={v => {
                              const found = assets.find(a => a.id === v)
                              if (found) onAssetChange(found)
                              setAssetComboOpen(false)
                            }}
                            className="cursor-pointer text-slate-200 data-[selected=true]:bg-slate-700"
                          >
                            <Check className={cn(
                              'mr-2 h-3.5 w-3.5 shrink-0',
                              item.matchedAsset?.id === asset.id ? 'opacity-100 text-emerald-400' : 'opacity-0',
                            )} />
                            <span className="font-mono text-emerald-400 mr-2 text-xs shrink-0">{asset.ticker}</span>
                            <span className="text-slate-400 text-xs truncate">{asset.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Row 3 (alt): show manually assigned asset */}
          {item.status === 'pending' && item.matchedAsset && !p.ticker && (
            <div className="flex items-center gap-2 text-xs pt-0.5">
              <span className="text-emerald-400">✓ Asignado:</span>
              <span className="font-mono text-emerald-300">{item.matchedAsset.ticker}</span>
              <span className="text-slate-500">— {item.matchedAsset.name}</span>
              <button
                onClick={() => onAssetChange(null as unknown as Asset)}
                className="text-slate-600 hover:text-slate-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {item.status === 'pending' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
              title="Ver detalles"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <Button
              size="sm" variant="ghost"
              onClick={onEdit}
              className="text-slate-400 hover:text-slate-200 h-8 px-2 gap-1"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={!canSave}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white h-8 px-3 gap-1"
            >
              <Save className="h-3.5 w-3.5" />
              Confirmar
            </Button>
            <button
              onClick={onDiscard}
              className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
              title="Descartar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {item.status === 'saving' && (
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400 shrink-0 mt-0.5" />
        )}
        {item.status === 'saved' && (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        )}
        {item.status === 'error' && (
          <button
            onClick={onDiscard}
            className="p-1.5 rounded text-slate-600 hover:text-slate-400 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Break-even info — shown after save for COMPRA */}
      {item.status === 'saved'
        && ['COMPRA', 'SUSCRIPCION_FCI'].includes(p.transaction_type ?? '')
        && (p.quantity ?? 0) > 0
        && (p.net_amount ?? 0) > 0
        && (
        <div className="border-t border-emerald-800/40 px-4 pb-3 pt-2">
          <BreakEvenInfo parsed={p} />
        </div>
      )}

      {/* Expanded details */}
      {expanded && item.status === 'pending' && (
        <div className="border-t border-slate-700/60 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <DataRow label="ALyC"            value={p.custodian_name} />
            <DataRow label="Nro. operación"  value={p.operation_number} />
            <DataRow label="Liquidación"     value={p.settlement_date} />
            <DataRow label="Comitente"       value={p.comitente} />
            <DataRow label="Bruto"           value={p.gross_amount != null ? `${fmt(p.gross_amount)} ${p.currency ?? 'ARS'}` : null} />
            <DataRow label="Comisión ALyC"   value={p.alyce_commission != null ? fmt(p.alyce_commission) : null} />
            <DataRow label="Otros aranceles" value={p.other_fees != null ? fmt(p.other_fees) : null} />
            <DataRow
              label="Activo en DB"
              value={item.matchedAsset
                ? `${item.matchedAsset.ticker} — ${item.matchedAsset.name}`
                : '⚠ no encontrado'}
            />
          </div>

          {p.notes && <p className="text-xs text-slate-500 italic">{p.notes}</p>}

          {/* FX section */}
          {isARS && (
            <div className="space-y-2 pt-1 border-t border-slate-700/40">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-2">
                Tipo de cambio
              </p>

              {/* Loading */}
              {item.fxLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando tipo de cambio…
                </div>
              )}

              {/* Auto-filled from lookup */}
              {!item.fxLoading && item.fxLookup && !fxEditMode && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    {item.fxLookup.mep != null && (
                      <span className={cn(
                        'text-xs',
                        item.fxLookup.typeUsed === 'MEP' ? 'text-white' : 'text-slate-400',
                      )}>
                        <span className="text-slate-500">MEP </span>
                        <span className="font-mono font-medium">${fmt(item.fxLookup.mep)}</span>
                        {item.fxLookup.typeUsed === 'MEP' && (
                          <span className="text-emerald-500 ml-1 text-[10px]">← recomendado</span>
                        )}
                      </span>
                    )}
                    {item.fxLookup.ccl != null && (
                      <span className={cn(
                        'text-xs',
                        item.fxLookup.typeUsed === 'CCL' ? 'text-white' : 'text-slate-400',
                      )}>
                        <span className="text-slate-500">CCL </span>
                        <span className="font-mono font-medium">${fmt(item.fxLookup.ccl)}</span>
                        {item.fxLookup.typeUsed === 'CCL' && (
                          <span className="text-emerald-500 ml-1 text-[10px]">← recomendado</span>
                        )}
                      </span>
                    )}
                    <button
                      onClick={() => setFxEditMode(true)}
                      className="text-xs text-slate-500 underline hover:text-slate-300"
                    >
                      editar
                    </button>
                  </div>
                  {item.fxLookup.warning && (
                    <p className="text-xs text-amber-400">⚠ {item.fxLookup.warning}</p>
                  )}
                </div>
              )}

              {/* No lookup data — always show inputs */}
              {!item.fxLoading && !item.fxLookup && (
                <p className="text-xs text-amber-400">
                  ⚠ No hay tipo de cambio registrado para esta fecha. Ingresalo manualmente.
                </p>
              )}

              {/* Manual inputs — shown when editing or no lookup */}
              {!item.fxLoading && (fxEditMode || !item.fxLookup) && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-slate-500 text-xs">MEP</Label>
                    <Input
                      type="number" step="0.01" placeholder="ej: 1285.50"
                      value={item.fxRateMep ?? ''}
                      onChange={e => onMepChange(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 h-7 text-xs w-[110px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-slate-500 text-xs">CCL</Label>
                    <Input
                      type="number" step="0.01" placeholder="ej: 1290.00"
                      value={item.fxRateCcl ?? ''}
                      onChange={e => onCclChange(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-slate-100 h-7 text-xs w-[110px]"
                    />
                  </div>
                  {fxEditMode && item.fxLookup && (
                    <button
                      onClick={revertFxToLookup}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      ← usar lookup
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-slate-600 min-w-[115px]">{label}:</span>
      <span className="text-slate-300">{value ?? '—'}</span>
    </div>
  )
}

function BreakEvenInfo({ parsed }: { parsed: ParsedTransaction }) {
  const qty        = parsed.quantity!
  const net        = parsed.net_amount!
  const netPerUnit = net / qty
  const breakEven  = netPerUnit * 1.00242
  const ccy        = parsed.currency ?? 'ARS'
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Break-even calculado</p>
      <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs">
        <span className="text-slate-500">
          Entrada: <span className="font-mono text-slate-300">{fmt(netPerUnit)} {ccy}/u</span>
        </span>
        <span className="text-slate-500">
          Break-even: <span className="font-mono text-amber-300">{fmt(breakEven)} {ccy}/u</span>
          <span className="text-slate-600 ml-1">(+0.24% comisión salida)</span>
        </span>
      </div>
    </div>
  )
}
