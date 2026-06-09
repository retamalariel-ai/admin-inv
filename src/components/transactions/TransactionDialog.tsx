'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Label }    from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { Database } from '@/types/database.types'
import PDFUploader, { type ParsedTransaction } from '@/components/transactions/PDFUploader'

// ── Types ──────────────────────────────────────────────────────────────────
type TxType   = Database['public']['Enums']['transaction_type']
type Currency = Database['public']['Enums']['currency']
type AssetType = Database['public']['Enums']['asset_type']
type Asset = Pick<
  Database['public']['Tables']['assets']['Row'],
  'id' | 'ticker' | 'name' | 'asset_type' | 'current_residual_factor'
>

// ── Constants ──────────────────────────────────────────────────────────────
const CRYPTO_ASSET_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_CRYPTO_NATIVE', 'CASH_CRYPTO_STABLE',
]

const BOND_ASSET_TYPES: AssetType[] = [
  'BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP',
]

const TX_GROUPS: { label: string; types: TxType[] }[] = [
  { label: 'Mercado de Capitales', types: ['COMPRA', 'VENTA', 'SUSCRIPCION_FCI', 'RESCATE_FCI'] },
  { label: 'Flujos de Renta',      types: ['RENTA', 'DIVIDENDO', 'AMORTIZACION'] },
  { label: 'Crypto',               types: ['INTERES_EARN', 'REWARD_DEFI', 'SWAP_CRYPTO'] },
  { label: 'Movimientos',          types: ['DEPOSITO', 'RETIRO', 'TRANSFERENCIA_IN', 'TRANSFERENCIA_OUT'] },
]

const TX_LABELS: Record<TxType, string> = {
  COMPRA: 'Compra', VENTA: 'Venta',
  SUSCRIPCION_FCI: 'Suscripción FCI', RESCATE_FCI: 'Rescate FCI',
  RENTA: 'Renta', DIVIDENDO: 'Dividendo', AMORTIZACION: 'Amortización',
  INTERES_EARN: 'Interés Earn', REWARD_DEFI: 'Reward DeFi', SWAP_CRYPTO: 'Swap Crypto',
  DEPOSITO: 'Depósito', RETIRO: 'Retiro',
  TRANSFERENCIA_IN: 'Transfer In', TRANSFERENCIA_OUT: 'Transfer Out',
  CANJE: 'Canje', SPLIT_ACCION: 'Split', BRIDGE_IN: 'Bridge In', BRIDGE_OUT: 'Bridge Out',
  FEE_CADENA: 'Fee Cadena', FEE_EXCHANGE: 'Fee Exchange',
  COMISION_ALYCE: 'Comisión ALyC', AJUSTE_PRECIO: 'Ajuste Precio',
}

const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'ARS',         label: 'ARS — Pesos' },
  { value: 'USD_MEP',     label: 'USD MEP' },
  { value: 'USD_CCL',     label: 'USD CCL' },
  { value: 'USD_CABLE',   label: 'USD Cable' },
  { value: 'USD_OFICIAL', label: 'USD Oficial' },
  { value: 'USD_BLUE',    label: 'USD Blue' },
  { value: 'USDT',        label: 'USDT' },
  { value: 'BTC',         label: 'BTC' },
  { value: 'ETH',         label: 'ETH' },
  { value: 'SOL',         label: 'SOL' },
]

// ── Net amount calculation ─────────────────────────────────────────────────
function calcNet(
  txType: TxType, gross: Decimal,
  commission: Decimal, gas: Decimal, other: Decimal,
): Decimal {
  const fees = commission.plus(gas).plus(other)
  switch (txType) {
    case 'COMPRA':
    case 'SUSCRIPCION_FCI':
    case 'DEPOSITO':
    case 'TRANSFERENCIA_IN':
      return gross.plus(fees)
    case 'VENTA':
    case 'RESCATE_FCI':
    case 'RETIRO':
    case 'TRANSFERENCIA_OUT':
      return gross.minus(fees)
    default:
      return gross
  }
}

// ── Date helpers ───────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }
function tPlusN(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Schema ─────────────────────────────────────────────────────────────────
const numStr = z.string().refine(v => !isNaN(parseFloat(v)), 'Valor inválido')

const schema = z.object({
  asset_id:          z.string().min(1, 'Seleccioná un activo'),
  trade_date:        z.string().min(1, 'Requerido'),
  settlement_date:   z.string().optional(),
  quantity:          z.string().min(1, 'Requerido').refine(v => {
                       try { return new Decimal(v).gt(0) } catch { return false }
                     }, 'Debe ser > 0'),
  price_per_unit:    z.string().min(1, 'Requerido').refine(v => {
                       try { return new Decimal(v).gte(0) } catch { return false }
                     }, 'Debe ser ≥ 0'),
  currency:          z.string().min(1, 'Seleccioná moneda'),
  alyce_commission:  numStr,
  gas_fee_amount:    numStr,
  gas_fee_currency:  z.string().optional(),
  other_fees:        numStr,
  fx_rate_mep:       z.string().optional(),
  fx_rate_ccl:       z.string().optional(),
  fx_rate_oficial:   z.string().optional(),
  crypto_price_usd:  z.string().optional(),
  swap_to_asset_id:  z.string().optional(),
  swap_to_quantity:  z.string().optional(),
  swap_to_price_usd: z.string().optional(),
  tx_hash:           z.string().optional(),
  protocol_name:     z.string().optional(),
  notes:             z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const DEFAULT_VALUES: FormValues = {
  asset_id: '', trade_date: todayISO(), settlement_date: tPlusN(2),
  quantity: '', price_per_unit: '', currency: 'ARS',
  alyce_commission: '0', gas_fee_amount: '0', gas_fee_currency: '',
  other_fees: '0', fx_rate_mep: '', fx_rate_ccl: '', fx_rate_oficial: '',
  crypto_price_usd: '', swap_to_asset_id: '', swap_to_quantity: '',
  swap_to_price_usd: '', tx_hash: '', protocol_name: '', notes: '',
}

// ── Props ──────────────────────────────────────────────────────────────────
export interface TransactionDialogProps {
  portfolioId:         string
  defaultAssetId?:     string
  defaultAssetTicker?: string
  prefill?:            ParsedTransaction | null
  open:                boolean
  onOpenChange:        (open: boolean) => void
  onSuccess:           () => void
}

// ── Component ──────────────────────────────────────────────────────────────
export default function TransactionDialog({
  portfolioId, defaultAssetId, defaultAssetTicker, prefill,
  open, onOpenChange, onSuccess,
}: TransactionDialogProps) {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [txType, setTxType]           = useState<TxType>('COMPRA')
  const [assetComboOpen, setAssetComboOpen] = useState(false)
  const [fxOpen, setFxOpen]           = useState(false)
  const [submitting, setSubmitting]   = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT_VALUES, asset_id: defaultAssetId ?? '' },
  })

  const { register, handleSubmit, formState: { errors }, setValue, watch, setError, reset } = form

  // Fetch assets once on open
  useEffect(() => {
    if (!open || assets.length > 0) return
    setAssetsLoading(true)
    const supabase = createClient()
    supabase
      .from('assets')
      .select('id, ticker, name, asset_type, current_residual_factor')
      .eq('is_active', true)
      .order('ticker')
      .then(({ data }) => {
        setAssets(data ?? [])
        setAssetsLoading(false)
      })
  }, [open, assets.length])

  // Reset form each time dialog opens
  useEffect(() => {
    if (!open) return
    reset({ ...DEFAULT_VALUES, asset_id: defaultAssetId ?? '' })
    setTxType('COMPRA')
    setFxOpen(false)
  }, [open, defaultAssetId, reset])

  // Apply parsed PDF data to the form
  const applyParsed = useCallback((data: ParsedTransaction) => {
    const txTypeMap: Partial<Record<string, TxType>> = {
      COMPRA: 'COMPRA', VENTA: 'VENTA',
      SUSCRIPCION_FCI: 'SUSCRIPCION_FCI', RESCATE_FCI: 'RESCATE_FCI',
      RENTA: 'RENTA', DIVIDENDO: 'DIVIDENDO', AMORTIZACION: 'AMORTIZACION',
      DEPOSITO: 'DEPOSITO', RETIRO: 'RETIRO',
      TRANSFERENCIA_IN: 'TRANSFERENCIA_IN', TRANSFERENCIA_OUT: 'TRANSFERENCIA_OUT',
    }
    if (data.transaction_type) {
      const t = txTypeMap[data.transaction_type]
      if (t) setTxType(t)
    }
    if (data.ticker) {
      const match = assets.find(a => a.ticker.toUpperCase() === data.ticker!.toUpperCase())
      if (match) setValue('asset_id', match.id, { shouldValidate: true })
    }
    if (data.trade_date)      setValue('trade_date', data.trade_date)
    if (data.settlement_date) setValue('settlement_date', data.settlement_date)
    if (data.quantity != null)       setValue('quantity', String(data.quantity))
    if (data.price_per_unit != null) setValue('price_per_unit', String(data.price_per_unit))
    setValue('alyce_commission', String(data.alyce_commission ?? 0))
    setValue('other_fees',       String(data.other_fees ?? 0))
    if (data.currency) setValue('currency', data.currency)
    const noteParts: string[] = []
    if (data.custodian_name)  noteParts.push(`ALyC: ${data.custodian_name}`)
    if (data.operation_number) noteParts.push(`Op: ${data.operation_number}`)
    if (data.notes) noteParts.push(data.notes)
    if (noteParts.length) setValue('notes', noteParts.join(' | '))
  }, [assets, setValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply `prefill` prop once assets are available
  const prefillApplied = useRef(false)
  useEffect(() => { if (!open) prefillApplied.current = false }, [open])
  useEffect(() => {
    if (!open || !prefill || prefillApplied.current || assets.length === 0) return
    prefillApplied.current = true
    applyParsed(prefill)
  }, [open, prefill, assets, applyParsed])

  // Watched values
  const watchedAssetId  = watch('asset_id')
  const watchedTradeDate = watch('trade_date')
  const watchedQty      = watch('quantity')
  const watchedPrice    = watch('price_per_unit')
  const watchedCurrency = watch('currency') as Currency
  const watchedComm     = watch('alyce_commission')
  const watchedGas      = watch('gas_fee_amount')
  const watchedOther    = watch('other_fees')
  const watchedGasCurr  = watch('gas_fee_currency')
  const watchedGasAmt   = watch('gas_fee_amount')

  const selectedAsset = useMemo(
    () => assets.find(a => a.id === watchedAssetId) ?? null,
    [assets, watchedAssetId],
  )

  const isCrypto = selectedAsset != null && CRYPTO_ASSET_TYPES.includes(selectedAsset.asset_type)
  const isBond   = selectedAsset != null && BOND_ASSET_TYPES.includes(selectedAsset.asset_type)
  const isSwap   = txType === 'SWAP_CRYPTO'
  const isAmort  = txType === 'AMORTIZACION'
  const isEarn   = txType === 'INTERES_EARN' || txType === 'REWARD_DEFI'
  const needsFx  = watchedCurrency === 'ARS'
  const gasAmt   = parseFloat(watchedGasAmt || '0')

  // Auto-expand FX section when relevant
  useEffect(() => {
    if (needsFx || isCrypto) setFxOpen(true)
  }, [needsFx, isCrypto])

  // Auto-fill FX rates when asset + date are both set
  useEffect(() => {
    if (!watchedTradeDate || !selectedAsset) return
    const ctrl = new AbortController()

    fetch('/api/fx-rates/lookup?' + new URLSearchParams({
      date:      watchedTradeDate,
      assetType: selectedAsset.asset_type,
      ticker:    selectedAsset.ticker,
    }), { signal: ctrl.signal })
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const rec = data?.recommended
        const ref = data?.reference
        if (!rec?.rate) return

        if (rec.type === 'MEP') {
          setValue('fx_rate_mep', String(rec.rate))
          if (ref?.rate) setValue('fx_rate_ccl', String(ref.rate))
        } else {
          setValue('fx_rate_ccl', String(rec.rate))
          if (ref?.rate) setValue('fx_rate_mep', String(ref.rate))
        }

        const dateLabel = rec.rate_date ?? watchedTradeDate
        const rateStr   = Number(rec.rate).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const suffix    = rec.exact ? '' : ` (del ${dateLabel})`
        toast.info(`${rec.type} $${rateStr}${suffix}`, { duration: 3000 })
      })
      .catch(() => {})

    return () => ctrl.abort()
  }, [watchedTradeDate, selectedAsset?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Calculated amounts
  const gross = useMemo(() => {
    try { return new Decimal(watchedQty || '0').mul(new Decimal(watchedPrice || '0')) }
    catch { return new Decimal(0) }
  }, [watchedQty, watchedPrice])

  const net = useMemo(() => {
    try {
      return calcNet(
        txType, gross,
        new Decimal(watchedComm  || '0'),
        new Decimal(watchedGas   || '0'),
        new Decimal(watchedOther || '0'),
      )
    } catch { return gross }
  }, [txType, gross, watchedComm, watchedGas, watchedOther])

  // Qty placeholder by asset type
  const qtyPlaceholder = selectedAsset == null
    ? 'Cantidad'
    : isBond        ? 'VN en unidades (ej: 10000)'
    : isCrypto      ? 'Cantidad (hasta 18 dec.)'
    : 'Número de títulos'

  // ── Submit ─────────────────────────────────────────────────────────────
  async function onSubmit(data: FormValues) {
    // Conditional validations
    if (needsFx && !data.fx_rate_mep) {
      setError('fx_rate_mep', { message: 'MEP requerido cuando la moneda es ARS' })
      setFxOpen(true)
      return
    }
    if (isCrypto && !data.crypto_price_usd) {
      setError('crypto_price_usd', { message: 'Precio USD requerido para activos crypto' })
      setFxOpen(true)
      return
    }
    if (isSwap) {
      if (!data.swap_to_asset_id) {
        setError('swap_to_asset_id', { message: 'Seleccioná activo destino' })
        return
      }
      if (!data.swap_to_quantity || new Decimal(data.swap_to_quantity).lte(0)) {
        setError('swap_to_quantity', { message: 'Cantidad destino requerida' })
        return
      }
    }

    setSubmitting(true)
    const supabase = createClient()

    const toNum  = (v?: string): number | null => (v ? parseFloat(v) : null)
    const numDef = (v?: string, d = 0)          => parseFloat(v || String(d))

    const { error } = await supabase.from('transactions').insert({
      portfolio_id:             portfolioId,
      asset_id:                 data.asset_id,
      transaction_type:         txType,
      trade_date:               data.trade_date,
      settlement_date:          data.settlement_date || null,
      quantity:                 parseFloat(data.quantity),
      price_per_unit:           parseFloat(data.price_per_unit),
      gross_amount:             gross.toNumber(),
      alyce_commission:         numDef(data.alyce_commission),
      gas_fee_amount:           numDef(data.gas_fee_amount),
      gas_fee_currency:         (gasAmt > 0 ? data.gas_fee_currency as Currency : null) || null,
      other_fees:               numDef(data.other_fees),
      net_amount:               net.toNumber(),
      currency:                 data.currency as Currency,
      fx_rate_mep:              toNum(data.fx_rate_mep),
      fx_rate_ccl:              toNum(data.fx_rate_ccl),
      fx_rate_oficial:          toNum(data.fx_rate_oficial),
      crypto_price_usd:         toNum(data.crypto_price_usd),
      swap_to_asset_id:         data.swap_to_asset_id || null,
      swap_to_quantity:         toNum(data.swap_to_quantity),
      swap_to_price_usd:        toNum(data.swap_to_price_usd),
      tx_hash:                  data.tx_hash || null,
      protocol_name:            data.protocol_name || null,
      residual_factor_at_trade: selectedAsset?.current_residual_factor ?? 1,
      notes:                    data.notes || null,
    })

    setSubmitting(false)

    if (error) {
      toast.error(`Error al guardar: ${error.message}`)
      return
    }

    toast.success('Transacción guardada correctamente')
    onOpenChange(false)
    onSuccess()
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            Nueva Transacción
            {defaultAssetTicker && (
              <span className="ml-2 font-mono text-emerald-400 text-sm">{defaultAssetTicker}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Importar desde PDF ── */}
        <PDFUploader onParsed={applyParsed} />
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-xs text-slate-600">o completar manualmente</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* ── SECCIÓN 1: tipo de transacción ── */}
        <div className="space-y-3">
          {TX_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.types.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTxType(type)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                      txType === type
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700',
                    )}
                  >
                    {TX_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-700 my-1" />

        {/* ── SECCIÓN 2: formulario ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Activo */}
          <div className="space-y-1">
            <Label className="text-slate-300">Activo *</Label>
            <Popover open={assetComboOpen} onOpenChange={setAssetComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  className={cn(
                    'w-full justify-between bg-slate-800 border-slate-700 font-normal hover:bg-slate-700',
                    watchedAssetId ? 'text-slate-100' : 'text-slate-500',
                  )}
                >
                  {watchedAssetId
                    ? (selectedAsset
                        ? `${selectedAsset.ticker} — ${selectedAsset.name}`
                        : (defaultAssetTicker ?? 'Cargando...'))
                    : 'Seleccionar activo...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[520px] p-0 bg-slate-800 border-slate-700"
                align="start"
              >
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
                    placeholder="Buscar por ticker o nombre..."
                    className="border-b border-slate-700 text-slate-100 placeholder:text-slate-500"
                  />
                  <CommandList className="max-h-56">
                    <CommandEmpty className="text-slate-500 text-sm py-6 text-center">
                      {assetsLoading ? 'Cargando activos...' : 'Sin resultados'}
                    </CommandEmpty>
                    <CommandGroup>
                      {assets.map(asset => (
                        <CommandItem
                          key={asset.id}
                          value={asset.id}
                          onSelect={v => {
                            setValue('asset_id', v, { shouldValidate: true })
                            setAssetComboOpen(false)
                          }}
                          className="cursor-pointer text-slate-200 data-[selected=true]:bg-slate-700"
                        >
                          <Check className={cn(
                            'mr-2 h-4 w-4 shrink-0',
                            watchedAssetId === asset.id ? 'opacity-100 text-emerald-400' : 'opacity-0',
                          )} />
                          <span className="font-mono font-semibold text-emerald-400 mr-2 shrink-0">
                            {asset.ticker}
                          </span>
                          <span className="text-slate-300 text-sm truncate">{asset.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.asset_id && <p className="text-xs text-red-400">{errors.asset_id.message}</p>}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Fecha de operación *</Label>
              <Input type="date" {...register('trade_date')}
                className="bg-slate-800 border-slate-700 text-slate-100" />
              {errors.trade_date && <p className="text-xs text-red-400">{errors.trade_date.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Fecha de liquidación</Label>
              <Input type="date" {...register('settlement_date')}
                className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
          </div>

          {/* Cantidad · Precio · Moneda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Cantidad *</Label>
              <Input {...register('quantity')} placeholder={qtyPlaceholder}
                className="bg-slate-800 border-slate-700 text-slate-100" />
              {errors.quantity && <p className="text-xs text-red-400">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Precio por unidad *</Label>
              <Input {...register('price_per_unit')} placeholder="0.00"
                className="bg-slate-800 border-slate-700 text-slate-100" />
              {errors.price_per_unit && <p className="text-xs text-red-400">{errors.price_per_unit.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Moneda *</Label>
              <Select value={watchedCurrency} onValueChange={v => setValue('currency', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Costos */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Comisión ALyC</Label>
                <Input {...register('alyce_commission')} placeholder="0"
                  className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-300">Otros fees</Label>
                <Input {...register('other_fees')} placeholder="0"
                  className="bg-slate-800 border-slate-700 text-slate-100" />
              </div>
            </div>
            {isCrypto && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-300">Gas fee</Label>
                  <Input {...register('gas_fee_amount')} placeholder="0"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
                {gasAmt > 0 && (
                  <div className="space-y-1">
                    <Label className="text-slate-300">Moneda del gas</Label>
                    <Select
                      value={watchedGasCurr ?? ''}
                      onValueChange={v => setValue('gas_fee_currency', v)}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                        {CURRENCIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Montos calculados */}
          <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Gross amount</p>
              <p className="font-mono font-semibold text-white tabular-nums">
                {gross.toFixed(2)} {watchedCurrency}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Net amount</p>
              <p className="font-mono font-semibold text-white tabular-nums">
                {net.toFixed(2)} {watchedCurrency}
              </p>
            </div>
          </div>

          {/* Tipos de cambio (collapsible) */}
          <Collapsible open={fxOpen} onOpenChange={setFxOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', fxOpen && 'rotate-180')} />
                Tipos de cambio
                {needsFx && <span className="text-xs text-amber-400 ml-1">(MEP requerido)</span>}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-300">
                    MEP{needsFx && <span className="text-red-400 ml-0.5">*</span>}
                  </Label>
                  <Input {...register('fx_rate_mep')} placeholder="ej: 1285.50"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                  {errors.fx_rate_mep && <p className="text-xs text-red-400">{errors.fx_rate_mep.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">CCL</Label>
                  <Input {...register('fx_rate_ccl')} placeholder="ej: 1290.00"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Oficial</Label>
                  <Input {...register('fx_rate_oficial')} placeholder="ej: 1050.00"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
              </div>
              {isCrypto && (
                <div className="space-y-1">
                  <Label className="text-slate-300">
                    Precio USD del crypto<span className="text-red-400 ml-0.5">*</span>
                  </Label>
                  <Input {...register('crypto_price_usd')} placeholder="ej: 65000.00"
                    className="bg-slate-800 border-slate-700 text-slate-100 max-w-[200px]" />
                  {errors.crypto_price_usd && (
                    <p className="text-xs text-red-400">{errors.crypto_price_usd.message}</p>
                  )}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Avisos contextuales */}
          {isAmort && (
            <div className="rounded-lg bg-amber-950/30 border border-amber-800/40 p-3">
              <p className="text-xs text-amber-300">
                <strong>Amortización:</strong> la cantidad representa el VN amortizado.
                La posición <em>quantity_held</em> no cambia.
              </p>
            </div>
          )}
          {isEarn && (
            <div className="rounded-lg bg-blue-950/30 border border-blue-800/40 p-3">
              <p className="text-xs text-blue-300">
                <strong>{txType === 'INTERES_EARN' ? 'Interés Earn' : 'Reward DeFi'}:</strong>{' '}
                el interés aumenta la cantidad con costo base = 0, lo que <strong>licúa el PPP</strong>.
              </p>
            </div>
          )}

          {/* Campos SWAP */}
          {isSwap && (
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 space-y-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                Destino del swap
              </p>
              <div className="space-y-1">
                <Label className="text-slate-300">Activo destino *</Label>
                <Select
                  value={watch('swap_to_asset_id') ?? ''}
                  onValueChange={v => setValue('swap_to_asset_id', v)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Seleccionar crypto destino..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                    {assets
                      .filter(a => CRYPTO_ASSET_TYPES.includes(a.asset_type))
                      .map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.ticker} — {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.swap_to_asset_id && (
                  <p className="text-xs text-red-400">{errors.swap_to_asset_id.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-300">Cantidad destino *</Label>
                  <Input {...register('swap_to_quantity')} placeholder="0.00000000"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                  {errors.swap_to_quantity && (
                    <p className="text-xs text-red-400">{errors.swap_to_quantity.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Precio USD destino</Label>
                  <Input {...register('swap_to_price_usd')} placeholder="0.00"
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
              </div>
            </div>
          )}

          {/* Crypto extras */}
          {isCrypto && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-slate-300">Hash de transacción</Label>
                <Input {...register('tx_hash')} placeholder="0x..."
                  className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs" />
              </div>
              {(txType === 'REWARD_DEFI' || txType === 'SWAP_CRYPTO') && (
                <div className="space-y-1">
                  <Label className="text-slate-300">Protocolo DeFi</Label>
                  <Input {...register('protocol_name')} placeholder="Uniswap, Aave..."
                    className="bg-slate-800 border-slate-700 text-slate-100" />
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <Label className="text-slate-300">Notas</Label>
            <Textarea {...register('notes')} placeholder="Observaciones opcionales..." rows={2}
              className="bg-slate-800 border-slate-700 text-slate-100 resize-none" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-200">
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {submitting ? 'Guardando...' : 'Guardar transacción'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
