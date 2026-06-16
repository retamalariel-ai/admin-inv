'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileUp, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Trash2,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { parseBinanceCSV } from '@/lib/crypto/binanceParser'
import { parseNexoCSV }    from '@/lib/crypto/nexoParser'
import type { CryptoParsedRow, BinanceSummaryEntry } from '@/lib/crypto/binanceParser'
import type { Database } from '@/types/database.types'

type TxType    = Database['public']['Enums']['transaction_type']
type AssetType = Database['public']['Enums']['asset_type']
type Currency  = Database['public']['Enums']['currency']

interface Portfolio {
  id:          string
  name:        string
  client_name: string
}

interface Asset {
  id:         string
  ticker:     string
  name:       string
  asset_type: AssetType
}

type ImportStatus = 'pending' | 'saving' | 'saved' | 'discarded' | 'error'

interface CryptoImportItem {
  id:             string
  row:            CryptoParsedRow
  status:         ImportStatus
  error?:         string
  asset?:         Asset | null
  txType?:        TxType
  overrideQty?:   string
  overridePrice?: string
  expanded:       boolean
}

type TabId = 'binance' | 'nexo' | 'safepal'

// ── Mappings ─────────────────────────────────────────────────────────────────
const SIDE_TO_TX: Record<CryptoParsedRow['side'], TxType> = {
  BUY:          'COMPRA',
  SELL:         'VENTA',
  EARN:         'INTERES_EARN',
  REWARD:       'REWARD_DEFI',
  TRANSFER_IN:  'DEPOSITO',
  TRANSFER_OUT: 'RETIRO',
  FEE:          'FEE_EXCHANGE',
  OTHER:        'DEPOSITO',
}

const CRYPTO_ASSET_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
]

const CRYPTO_TX_TYPES: { value: TxType; label: string }[] = [
  { value: 'COMPRA',        label: 'Compra' },
  { value: 'VENTA',         label: 'Venta' },
  { value: 'SWAP_CRYPTO',   label: 'Swap' },
  { value: 'INTERES_EARN',  label: 'Interés Earn' },
  { value: 'REWARD_DEFI',   label: 'Reward DeFi' },
  { value: 'DEPOSITO',      label: 'Depósito' },
  { value: 'RETIRO',        label: 'Retiro' },
  { value: 'BRIDGE_IN',     label: 'Bridge IN' },
  { value: 'BRIDGE_OUT',    label: 'Bridge OUT' },
  { value: 'FEE_CADENA',    label: 'Fee de Red' },
  { value: 'FEE_EXCHANGE',  label: 'Fee de Exchange' },
]

const SAFEPAL_NETWORKS  = ['Ethereum', 'BSC', 'Polygon', 'Avalanche', 'Solana', 'Tron', 'Bitcoin', 'Arbitrum', 'Optimism', 'Base', 'Otro']
const SAFEPAL_PROTOCOLS = ['Spot', 'Staking', 'Earn / Lending', 'DeFi LP', 'Bridge', 'Otro']

interface SafePalForm {
  network: string; protocol: string; txType: TxType | ''
  coin: string; quantity: string; price: string
  feeCoin: string; feeAmount: string; txHash: string
  apy: string; date: string; notes: string
}

const EMPTY_SAFEPAL: SafePalForm = {
  network: '', protocol: '', txType: '', coin: '',
  quantity: '', price: '', feeCoin: '', feeAmount: '',
  txHash: '', apy: '', date: new Date().toISOString().slice(0, 10), notes: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number | undefined | null, dec = 6) {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: dec })
}

function fmtNet(qty: number, coin: string) {
  const sign = qty >= 0 ? '+' : ''
  const decimals = Math.abs(qty) < 1 ? 6 : 4
  return `${sign}${qty.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: decimals })} ${coin}`
}

// Maps coin symbols to valid currency enum values.
// 'USD' and unknown coins fall back to 'USDT' / 'CRYPTO_OTHER'.
const COIN_TO_CURRENCY: Partial<Record<string, Currency>> = {
  USDT: 'USDT', USDC: 'USDC', DAI: 'DAI',
  BUSD: 'USDT', FDUSD: 'USDT', USD: 'USDT',   // USD is not in enum → USDT
  BTC: 'BTC', ETH: 'ETH', BNB: 'BNB',
  ARS: 'ARS', MATIC: 'MATIC', ADA: 'ADA',
  SOL: 'CRYPTO_OTHER', XRP: 'CRYPTO_OTHER', LINK: 'CRYPTO_OTHER',
  LTC: 'CRYPTO_OTHER', NEXO: 'CRYPTO_OTHER',
}

function toCurrency(coin: string): Currency {
  return COIN_TO_CURRENCY[coin.toUpperCase()] ?? 'CRYPTO_OTHER'
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ImportarCryptoPage() {
  const [activeTab, setActiveTab]               = useState<TabId>('binance')
  const [portfolios, setPortfolios]             = useState<Portfolio[]>([])
  const [assets, setAssets]                     = useState<Asset[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState('')
  const [parseErrors, setParseErrors]           = useState<string[]>([])
  const [queue, setQueue]                       = useState<CryptoImportItem[]>([])
  const [summary, setSummary]                   = useState<BinanceSummaryEntry[]>([])
  const [selectedCoins, setSelectedCoins]       = useState<Set<string>>(new Set())
  const [viewMode, setViewMode]                 = useState<'summary' | 'detail'>('summary')
  const [safepalForm, setSafepalForm]           = useState<SafePalForm>(EMPTY_SAFEPAL)
  const [safepalAsset, setSafepalAsset]         = useState<Asset | null>(null)
  const [safepalSaving, setSafepalSaving]       = useState(false)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('portfolios')
      .select('id, name, clients(full_name)')
      .eq('is_active', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }) => {
        const rows = ((data ?? []) as any[]).map(p => ({
          id:          p.id as string,
          name:        p.name as string,
          client_name: (p.clients as { full_name: string } | null)?.full_name ?? '',
        }))
        rows.sort((a, b) => a.client_name.localeCompare(b.client_name, 'es') || a.name.localeCompare(b.name, 'es'))
        setPortfolios(rows)
      })

    supabase
      .from('assets')
      .select('id, ticker, name, asset_type')
      .in('asset_type', CRYPTO_ASSET_TYPES)
      .eq('is_active', true)
      .order('ticker')
      .then(({ data }) => setAssets((data as Asset[]) ?? []))
  }, [])

  // ── CSV parsing ─────────────────────────────────────────────────────────────
  const handleCSV = useCallback((text: string, source: 'binance' | 'nexo') => {
    let rows: CryptoParsedRow[]
    let errors: string[]
    let newSummary: BinanceSummaryEntry[] = []

    if (source === 'binance') {
      const result = parseBinanceCSV(text)
      rows       = result.rows
      errors     = result.errors
      newSummary = result.summary
    } else {
      const result = parseNexoCSV(text)
      rows   = result.rows
      errors = result.errors
    }

    setParseErrors(errors)
    if (rows.length === 0) {
      toast.error(errors[0] ?? 'No se encontraron filas')
      return
    }

    const items: CryptoImportItem[] = rows.map(row => {
      const ticker = row.baseCoin.toUpperCase()
      const asset  = assets.find(a => a.ticker.toUpperCase() === ticker) ?? null
      return {
        id:      crypto.randomUUID(),
        row,
        status:  'pending',
        asset,
        txType:  SIDE_TO_TX[row.side],
        expanded: false,
      }
    })

    setSummary(newSummary)
    setSelectedCoins(new Set(newSummary.map(s => s.baseCoin)))
    setQueue(items)
    setViewMode('summary')

    const mergedCount = items.reduce((s, it) => s + (it.row.mergedCount ?? 1), 0)
    const merged = mergedCount - items.length
    toast.success(
      `${items.length} operaciones parseadas${merged > 0 ? ` (${merged} micro-txs agrupadas)` : ''}${errors.length ? ` · ${errors.length} errores` : ''}`,
    )
  }, [assets])

  // ── Dropzone ─────────────────────────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept:         { 'text/csv': ['.csv'], 'text/plain': ['.csv', '.txt'] },
    multiple:       false,
    onDropAccepted: async ([file]) => {
      const text = await file.text()
      handleCSV(text, activeTab as 'binance' | 'nexo')
    },
    onDropRejected: () => toast.error('Solo se aceptan archivos CSV'),
    disabled:       activeTab === 'safepal',
  })

  // ── Save helpers ────────────────────────────────────────────────────────────
  async function saveItem(item: CryptoImportItem) {
    if (!selectedPortfolio) { toast.error('Seleccioná un portfolio'); return }
    if (!item.asset)        { toast.error('Asigná el activo'); return }
    if (!item.txType)       { toast.error('Asigná el tipo de transacción'); return }

    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saving' } : it))
    const supabase = createClient()

    const qty   = parseFloat(item.overrideQty   ?? String(item.row.quantity))
    const price = parseFloat(item.overridePrice ?? String(item.row.price ?? 0))
    const total = qty * price || (item.row.total ?? 0)

    const { error } = await supabase.from('transactions').insert({
      portfolio_id:             selectedPortfolio,
      asset_id:                 item.asset.id,
      transaction_type:         item.txType,
      trade_date:               item.row.date,
      settlement_date:          item.row.date,
      quantity:                 qty,
      price_per_unit:           price,
      gross_amount:             total,
      alyce_commission:         0,
      gas_fee_amount:           item.row.fee ?? 0,
      other_fees:               0,
      net_amount:               total,
      currency:                 toCurrency(item.row.quoteCoin),
      fx_rate_mep:              null,
      fx_rate_ccl:              null,
      residual_factor_at_trade: 1,
      notes: [
        `Fuente: ${item.row.source.toUpperCase()}`,
        item.row.mergedCount ? `Micro-txs agrupadas: ${item.row.mergedCount}` : '',
        item.row.rawType     ? `Tipo: ${item.row.rawType}` : '',
        item.row.notes ?? '',
      ].filter(Boolean).join(' | ') || null,
    })

    if (error) {
      setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', error: error.message } : it))
      toast.error(`Error: ${error.message}`)
      return
    }

    setQueue(prev => prev.map(it => it.id === item.id ? { ...it, status: 'saved' } : it))
  }

  // Importar filas de coins seleccionadas
  async function saveSelected() {
    if (!selectedPortfolio) { toast.error('Seleccioná un portfolio'); return }
    const toSave = queue.filter(it =>
      it.status === 'pending' && it.asset && it.txType &&
      selectedCoins.has(it.row.baseCoin),
    )
    if (toSave.length === 0) { toast.error('No hay operaciones listas para importar'); return }

    toast(`Importando ${toSave.length} operaciones…`)
    let ok = 0
    for (const item of toSave) {
      await saveItem(item)
      ok++
    }
    toast.success(`${ok} operaciones importadas`)
  }

  // ── SafePal save ─────────────────────────────────────────────────────────────
  async function saveSafepal() {
    if (!selectedPortfolio) { toast.error('Seleccioná un portfolio'); return }
    if (!safepalAsset)      { toast.error('Seleccioná el activo'); return }
    if (!safepalForm.txType){ toast.error('Seleccioná el tipo de operación'); return }

    setSafepalSaving(true)
    const supabase = createClient()
    const qty   = parseFloat(safepalForm.quantity || '0')
    const price = parseFloat(safepalForm.price    || '0')
    const fee   = parseFloat(safepalForm.feeAmount || '0')

    const { error } = await supabase.from('transactions').insert({
      portfolio_id:             selectedPortfolio,
      asset_id:                 safepalAsset.id,
      transaction_type:         safepalForm.txType as TxType,
      trade_date:               safepalForm.date,
      settlement_date:          safepalForm.date,
      quantity:                 qty,
      price_per_unit:           price,
      gross_amount:             qty * price,
      alyce_commission:         0,
      gas_fee_amount:           fee,
      other_fees:               0,
      net_amount:               qty * price,
      currency:                 'USDT',
      fx_rate_mep:              null,
      fx_rate_ccl:              null,
      residual_factor_at_trade: 1,
      notes: [
        'Fuente: SafePal',
        safepalForm.network  ? `Red: ${safepalForm.network}`        : '',
        safepalForm.protocol ? `Protocolo: ${safepalForm.protocol}` : '',
        safepalForm.txHash   ? `TxHash: ${safepalForm.txHash}`      : '',
        safepalForm.apy      ? `APY: ${safepalForm.apy}%`           : '',
        safepalForm.notes,
      ].filter(Boolean).join(' | ') || null,
    })

    setSafepalSaving(false)
    if (error) { toast.error(`Error: ${error.message}`); return }
    toast.success(`Guardado: ${safepalAsset.ticker} ${safepalForm.txType}`)
    setSafepalForm(EMPTY_SAFEPAL)
    setSafepalAsset(null)
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const visibleItems   = queue.filter(it => it.status !== 'discarded' && selectedCoins.has(it.row.baseCoin))
  const pendingVisible = visibleItems.filter(it => it.status === 'pending')
  const savedVisible   = visibleItems.filter(it => it.status === 'saved')
  const noAsset        = pendingVisible.filter(it => !it.asset)
  const readyToSave    = pendingVisible.filter(it => it.asset && it.txType)

  function toggleCoin(coin: string) {
    setSelectedCoins(prev => {
      const next = new Set(prev)
      if (next.has(coin)) next.delete(coin)
      else next.add(coin)
      return next
    })
  }

  const allSelected  = summary.length > 0 && selectedCoins.size === summary.length
  const noneSelected = selectedCoins.size === 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">Importar Operaciones Crypto</h1>
        <p className="text-sm text-slate-400 mt-1">
          Importá operaciones desde Binance o Nexo (CSV), o cargá manualmente operaciones de SafePal.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-1 w-fit">
        {(['binance', 'nexo', 'safepal'] as TabId[]).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab)
              setQueue([])
              setSummary([])
              setSelectedCoins(new Set())
              setParseErrors([])
            }}
            className={cn(
              'px-4 py-1.5 text-sm rounded-md font-medium transition-colors',
              activeTab === tab ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {tab === 'binance' ? 'Binance CSV' : tab === 'nexo' ? 'Nexo CSV' : 'SafePal Manual'}
          </button>
        ))}
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
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── BINANCE / NEXO TABS ── */}
      {activeTab !== 'safepal' && (
        <>
          {/* Dropzone */}
          {queue.length === 0 && (
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
                  {isDragActive
                    ? 'Soltá el CSV acá'
                    : `Arrastrá el CSV de ${activeTab === 'binance' ? 'Binance Spot' : 'Nexo'} o hacé click`}
                </p>
                <p className="text-slate-600 text-xs mt-1">
                  {activeTab === 'binance'
                    ? 'Binance → Órdenes → Historial de Órdenes Spot → Exportar (EN o ES)'
                    : 'Nexo → Transacciones → Exportar CSV'}
                </p>
              </div>
            </div>
          )}

          {/* Parse errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-lg bg-red-950/20 border border-red-800 p-3 space-y-1">
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wide">Errores de parseo</p>
              {parseErrors.map((e, i) => <p key={i} className="text-xs text-red-300">{e}</p>)}
            </div>
          )}

          {/* ── Summary + Detail ── */}
          {queue.length > 0 && (
            <div className="space-y-4">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="text-slate-300 font-medium">
                    {queue.length} operaciones
                    {(() => {
                      const mc = queue.reduce((s, it) => s + (it.row.mergedCount ?? 1), 0)
                      return mc > queue.length ? ` (${mc} filas agrupadas)` : ''
                    })()}
                  </span>
                  {savedVisible.length   > 0 && <span className="text-emerald-400">{savedVisible.length} guardadas</span>}
                  {pendingVisible.length > 0 && <span className="text-amber-400">{pendingVisible.length} pendientes</span>}
                  {noAsset.length        > 0 && <span className="text-red-400">{noAsset.length} sin activo</span>}
                </div>
                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  <div className="flex gap-0.5 bg-slate-800 border border-slate-700 rounded p-0.5">
                    <button
                      onClick={() => setViewMode('summary')}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded transition-colors',
                        viewMode === 'summary' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      Resumen
                    </button>
                    <button
                      onClick={() => setViewMode('detail')}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded transition-colors',
                        viewMode === 'detail' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      Detalle
                    </button>
                  </div>
                  <Button
                    size="sm"
                    onClick={saveSelected}
                    disabled={readyToSave.length === 0 || !selectedPortfolio}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white h-8"
                  >
                    Importar seleccionados ({readyToSave.length})
                  </Button>
                  <button
                    onClick={() => { setQueue([]); setSummary([]); setSelectedCoins(new Set()) }}
                    className="text-xs text-slate-600 hover:text-slate-400"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* ── SUMMARY VIEW ── */}
              {viewMode === 'summary' && summary.length > 0 && (
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                      Resumen por activo
                    </p>
                    <button
                      onClick={() => {
                        if (allSelected) setSelectedCoins(new Set())
                        else setSelectedCoins(new Set(summary.map(s => s.baseCoin)))
                      }}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </button>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/50 text-slate-500 text-xs">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="text-left px-3 py-2">Activo</th>
                        <th className="text-right px-3 py-2">Compras</th>
                        <th className="text-right px-3 py-2">Ventas</th>
                        <th className="text-right px-3 py-2">Total ops</th>
                        <th className="text-right px-3 py-2">Posición neta</th>
                        <th className="text-right px-3 py-2">En DB</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {summary.map(s => {
                        const coin    = s.baseCoin
                        const checked = selectedCoins.has(coin)
                        const dbAsset = assets.find(a => a.ticker.toUpperCase() === coin)
                        const isNet   = s.netQty >= 0

                        // Count saved for this coin
                        const savedForCoin   = queue.filter(it => it.row.baseCoin === coin && it.status === 'saved').length
                        const pendingForCoin = queue.filter(it => it.row.baseCoin === coin && it.status === 'pending').length

                        return (
                          <tr
                            key={coin}
                            onClick={() => toggleCoin(coin)}
                            className={cn(
                              'cursor-pointer transition-colors',
                              checked ? 'bg-slate-800/40 hover:bg-slate-800' : 'opacity-50 hover:opacity-70 bg-slate-900',
                            )}
                          >
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCoin(coin)}
                                onClick={e => e.stopPropagation()}
                                className="accent-emerald-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono font-semibold text-emerald-400">{coin}</span>
                              <span className="text-slate-500 text-xs ml-2">{s.quoteCoin}</span>
                            </td>
                            <td className="px-3 py-3 text-right text-slate-300">
                              {s.buyCount > 0 && (
                                <span className="flex items-center justify-end gap-1">
                                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                                  {s.buyCount}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-300">
                              {s.sellCount > 0 && (
                                <span className="flex items-center justify-end gap-1">
                                  <TrendingDown className="h-3 w-3 text-red-400" />
                                  {s.sellCount}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-400 text-xs">
                              {s.buyCount + s.sellCount}
                              {savedForCoin > 0 && (
                                <span className="text-emerald-500 ml-1.5">({savedForCoin} ✓)</span>
                              )}
                              {pendingForCoin === 0 && savedForCoin > 0 && (
                                <span className="text-emerald-400 ml-1">completo</span>
                              )}
                            </td>
                            <td className={cn(
                              'px-3 py-3 text-right font-mono text-xs font-medium',
                              isNet ? 'text-emerald-400' : 'text-red-400',
                            )}>
                              {fmtNet(s.netQty, coin)}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {dbAsset ? (
                                <span className="text-xs text-emerald-500">✓ {dbAsset.name}</span>
                              ) : (
                                <span className="text-xs text-red-400">⚠ No existe</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Missing assets warning */}
                  {summary.some(s => !assets.find(a => a.ticker.toUpperCase() === s.baseCoin)) && (
                    <div className="border-t border-slate-700 bg-amber-950/10 px-4 py-3">
                      <p className="text-xs text-amber-400 font-medium mb-1">Activos no encontrados en la DB:</p>
                      <p className="text-xs text-amber-300/70 font-mono">
                        {summary
                          .filter(s => !assets.find(a => a.ticker.toUpperCase() === s.baseCoin))
                          .map(s => s.baseCoin)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Creá esos activos en la DB antes de importar, o seleccioná el activo manualmente en la vista Detalle.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── DETAIL VIEW ── */}
              {viewMode === 'detail' && (
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  {/* Coin filter chips */}
                  {summary.length > 0 && (
                    <div className="bg-slate-800/50 border-b border-slate-700 px-3 py-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs text-slate-500">Filtrar:</span>
                      <button
                        onClick={() => noneSelected
                          ? setSelectedCoins(new Set(summary.map(s => s.baseCoin)))
                          : setSelectedCoins(new Set())
                        }
                        className="text-xs px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-slate-200"
                      >
                        {noneSelected ? 'Todos' : 'Ninguno'}
                      </button>
                      {summary.map(s => (
                        <button
                          key={s.baseCoin}
                          onClick={() => toggleCoin(s.baseCoin)}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded border font-mono transition-colors',
                            selectedCoins.has(s.baseCoin)
                              ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                              : 'border-slate-700 text-slate-500',
                          )}
                        >
                          {s.baseCoin}
                        </button>
                      ))}
                    </div>
                  )}

                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                      <tr>
                        <th className="text-left px-3 py-2">Fecha</th>
                        <th className="text-left px-3 py-2">Activo</th>
                        <th className="text-left px-3 py-2">Tipo</th>
                        <th className="text-right px-3 py-2">Cantidad</th>
                        <th className="text-right px-3 py-2">Precio</th>
                        <th className="text-right px-3 py-2">Total</th>
                        <th className="text-left px-3 py-2">Estado</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {queue
                        .filter(it => it.status !== 'discarded' && selectedCoins.has(it.row.baseCoin))
                        .map(item => (
                          <CryptoRow
                            key={item.id}
                            item={item}
                            assets={assets}
                            onAssetChange={asset => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, asset } : it)
                            )}
                            onTxTypeChange={txType => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, txType } : it)
                            )}
                            onToggleExpand={() => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, expanded: !it.expanded } : it)
                            )}
                            onQtyChange={val => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, overrideQty: val } : it)
                            )}
                            onPriceChange={val => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, overridePrice: val } : it)
                            )}
                            onSave={() => saveItem(item)}
                            onDiscard={() => setQueue(prev =>
                              prev.map(it => it.id === item.id ? { ...it, status: 'discarded' } : it)
                            )}
                          />
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SAFEPAL TAB ── */}
      {activeTab === 'safepal' && (
        <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Cargar operación manual SafePal</h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Red */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Red / Blockchain</Label>
              <Select
                value={safepalForm.network}
                onValueChange={v => setSafepalForm(f => ({ ...f, network: v }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar red..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {SAFEPAL_NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Protocolo */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Protocolo / Tipo de activo</Label>
              <Select
                value={safepalForm.protocol}
                onValueChange={v => setSafepalForm(f => ({ ...f, protocol: v }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar protocolo..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {SAFEPAL_PROTOCOLS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de tx */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Tipo de operación *</Label>
              <Select
                value={safepalForm.txType}
                onValueChange={v => setSafepalForm(f => ({ ...f, txType: v as TxType }))}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {CRYPTO_TX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Fecha *</Label>
              <Input
                type="date"
                value={safepalForm.date}
                onChange={e => setSafepalForm(f => ({ ...f, date: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* Activo */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Activo *</Label>
              <Select
                value={safepalAsset?.id ?? ''}
                onValueChange={id => setSafepalAsset(assets.find(a => a.id === id) ?? null)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
                  <SelectValue placeholder="Seleccionar activo..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-52">
                  {assets.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-emerald-400 mr-2">{a.ticker}</span>
                      <span className="text-slate-400">{a.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Cantidad</Label>
              <Input
                type="number" step="any" placeholder="0.00000000"
                value={safepalForm.quantity}
                onChange={e => setSafepalForm(f => ({ ...f, quantity: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* Precio */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Precio (USD)</Label>
              <Input
                type="number" step="any" placeholder="0.00"
                value={safepalForm.price}
                onChange={e => setSafepalForm(f => ({ ...f, price: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* APY */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">APY % (opcional)</Label>
              <Input
                type="number" step="0.01" placeholder="ej: 12.5"
                value={safepalForm.apy}
                onChange={e => setSafepalForm(f => ({ ...f, apy: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* Fee coin */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Moneda de fee</Label>
              <Input
                placeholder="ej: ETH, BNB"
                value={safepalForm.feeCoin}
                onChange={e => setSafepalForm(f => ({ ...f, feeCoin: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* Fee amount */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Monto de fee</Label>
              <Input
                type="number" step="any" placeholder="0.00"
                value={safepalForm.feeAmount}
                onChange={e => setSafepalForm(f => ({ ...f, feeAmount: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>

            {/* TX Hash */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-400 text-xs">Hash de transacción (opcional)</Label>
              <Input
                placeholder="0x..."
                value={safepalForm.txHash}
                onChange={e => setSafepalForm(f => ({ ...f, txHash: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm font-mono"
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-slate-400 text-xs">Notas</Label>
              <Input
                placeholder="Observaciones adicionales..."
                value={safepalForm.notes}
                onChange={e => setSafepalForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={saveSafepal}
              disabled={safepalSaving || !safepalAsset || !safepalForm.txType}
              className="bg-emerald-700 hover:bg-emerald-600 text-white gap-2"
            >
              {safepalSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar operación
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── CryptoRow ─────────────────────────────────────────────────────────────────
interface CryptoRowProps {
  item:           CryptoImportItem
  assets:         Asset[]
  onAssetChange:  (a: Asset | null) => void
  onTxTypeChange: (t: TxType) => void
  onToggleExpand: () => void
  onQtyChange:    (v: string) => void
  onPriceChange:  (v: string) => void
  onSave:         () => void
  onDiscard:      () => void
}

function CryptoRow({
  item, assets, onAssetChange, onTxTypeChange,
  onToggleExpand, onQtyChange, onPriceChange, onSave, onDiscard,
}: CryptoRowProps) {
  const r = item.row

  const rowBg: Record<ImportStatus, string> = {
    pending:   'bg-slate-900 hover:bg-slate-800/70',
    saving:    'bg-slate-900 opacity-60',
    saved:     'bg-emerald-950/20',
    discarded: 'hidden',
    error:     'bg-red-950/10',
  }

  return (
    <>
      <tr className={cn('transition-colors', rowBg[item.status])}>
        {/* Fecha */}
        <td className="px-3 py-2 text-slate-400 tabular-nums whitespace-nowrap">
          {r.date}
          {r.time && <span className="text-slate-600 ml-1">{r.time.slice(0, 5)}</span>}
          {r.mergedCount && r.mergedCount > 1 && (
            <span className="ml-1 text-[10px] text-amber-500" title={`${r.mergedCount} micro-txs agrupadas`}>
              ×{r.mergedCount}
            </span>
          )}
        </td>

        {/* Activo */}
        <td className="px-3 py-2">
          {item.asset ? (
            <span className="font-mono text-emerald-400">{item.asset.ticker}</span>
          ) : (
            <Select onValueChange={id => onAssetChange(assets.find(a => a.id === id) ?? null)}>
              <SelectTrigger className="bg-red-950/30 border-red-800 text-red-400 h-6 text-[11px] w-28">
                <SelectValue placeholder={r.baseCoin} />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100 max-h-48">
                {assets.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    <span className="font-mono text-emerald-400 mr-1.5">{a.ticker}</span>
                    <span className="text-slate-400">{a.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </td>

        {/* TxType */}
        <td className="px-3 py-2">
          <Select value={item.txType ?? ''} onValueChange={v => onTxTypeChange(v as TxType)}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300 h-6 text-[11px] w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
              {CRYPTO_TX_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>

        <td className="px-3 py-2 text-right font-mono text-slate-300">{fmt(r.quantity, 8)}</td>
        <td className="px-3 py-2 text-right font-mono text-slate-300">{r.price != null ? `$${fmt(r.price, 4)}` : '—'}</td>
        <td className="px-3 py-2 text-right font-mono text-slate-300">
          {r.total != null ? `$${fmt(r.total, 2)}` : r.usdEquivalent != null ? `$${fmt(r.usdEquivalent, 2)}` : '—'}
        </td>

        {/* Status */}
        <td className="px-3 py-2">
          {item.status === 'saved' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          {item.status === 'error' && (
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />{item.error?.slice(0, 30)}
            </span>
          )}
          {item.status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
        </td>

        {/* Actions */}
        <td className="px-2 py-1.5">
          {item.status === 'pending' && (
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleExpand}
                className="p-1 text-slate-600 hover:text-slate-300 transition-colors"
              >
                {item.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={onSave}
                disabled={!item.asset || !item.txType}
                className="text-[10px] px-2 py-0.5 rounded bg-emerald-800 text-emerald-200 hover:bg-emerald-700 disabled:opacity-30 transition-colors"
              >
                OK
              </button>
              <button
                onClick={onDiscard}
                className="p-1 text-slate-700 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {item.expanded && item.status === 'pending' && (
        <tr className="bg-slate-900/80 border-b border-slate-800">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="space-y-1">
                <Label className="text-slate-500 text-[10px]">Cantidad override</Label>
                <Input
                  type="number" step="any" placeholder={String(r.quantity)}
                  value={item.overrideQty ?? ''}
                  onChange={e => onQtyChange(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 h-6 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-500 text-[10px]">Precio USD override</Label>
                <Input
                  type="number" step="any" placeholder={String(r.price ?? 0)}
                  value={item.overridePrice ?? ''}
                  onChange={e => onPriceChange(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 h-6 text-xs"
                />
              </div>
              {r.fee != null && (
                <div className="space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase block">Fee</span>
                  <span className="text-slate-300 font-mono">{r.fee} {r.feeCoin ?? ''}</span>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-slate-500 text-[10px] uppercase block">Par</span>
                <span className="text-slate-400 font-mono">{r.baseCoin}/{r.quoteCoin}</span>
              </div>
              {r.mergedCount && r.mergedCount > 1 && (
                <div className="space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase block">Micro-txs</span>
                  <span className="text-amber-400">{r.mergedCount} operaciones agrupadas</span>
                </div>
              )}
              {r.notes && (
                <div className="space-y-1 col-span-2">
                  <span className="text-slate-500 text-[10px] uppercase block">Detalle</span>
                  <span className="text-slate-400">{r.notes}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
