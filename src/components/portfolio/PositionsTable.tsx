'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatARS, formatUSD, formatPct, formatCrypto } from '@/lib/utils/calculations'
import TransactionDialog from '@/components/transactions/TransactionDialog'
import { usePnLView } from '@/hooks/usePnLView'
import type { Database } from '@/types/database.types'

type Position = Database['public']['Views']['portfolio_valuation_unified']['Row'] & {
  daily_pnl_ars?:    number | null
  daily_change_pct?: number | null
}
type AssetType = Database['public']['Enums']['asset_type']

interface PositionsTableProps {
  portfolioId:   string
  positions:     Position[]
  baseCurrency?: string
  totalAUM?:     number
}

const ASSET_LABELS: Record<AssetType, string> = {
  ACCION_LOCAL:       'Acción',
  CEDEAR:             'CEDEAR',
  BONO_SOBERANO:      'Bono Sob.',
  BONO_SUBSOBERANO:   'Bono Sub.',
  ON:                 'ON',
  LETES:              'LETES',
  LECAP:              'LECAP',
  FCI_MONEY_MARKET:   'FCI MM',
  FCI_RENTA_FIJA:     'FCI RF',
  FCI_RENTA_VARIABLE: 'FCI RV',
  FCI_RENTA_MIXTA:    'FCI Mix',
  CRYPTO_SPOT:        'Crypto',
  CRYPTO_STABLECOIN:  'Stable',
  CRYPTO_EARN:        'Earn',
  CRYPTO_DEFI_LP:     'DeFi LP',
  CRYPTO_DEFI_STAKE:  'Stake',
  CRYPTO_DEFI_LENDING:'Lending',
  CASH_ARS:           'Cash ARS',
  CASH_USD_MEP:       'Cash USD',
  CASH_USD_CCL:       'Cash CCL',
  CASH_CRYPTO_STABLE: 'Cash Stbl',
  CASH_CRYPTO_NATIVE: 'Cash Nat.',
}

const ASSET_COLOR: Partial<Record<AssetType, string>> = {
  ACCION_LOCAL:        'bg-blue-900/60 text-blue-300',
  CEDEAR:              'bg-indigo-900/60 text-indigo-300',
  BONO_SOBERANO:       'bg-emerald-900/60 text-emerald-300',
  BONO_SUBSOBERANO:    'bg-teal-900/60 text-teal-300',
  ON:                  'bg-cyan-900/60 text-cyan-300',
  LETES:               'bg-emerald-900/50 text-emerald-400',
  LECAP:               'bg-emerald-800/50 text-emerald-300',
  FCI_MONEY_MARKET:    'bg-slate-700 text-slate-300',
  FCI_RENTA_FIJA:      'bg-slate-700 text-slate-300',
  FCI_RENTA_VARIABLE:  'bg-blue-900/50 text-blue-300',
  FCI_RENTA_MIXTA:     'bg-blue-800/50 text-blue-400',
  CRYPTO_SPOT:         'bg-amber-900/60 text-amber-300',
  CRYPTO_STABLECOIN:   'bg-amber-800/50 text-amber-400',
  CRYPTO_EARN:         'bg-orange-900/60 text-orange-300',
  CRYPTO_DEFI_LP:      'bg-purple-900/60 text-purple-300',
  CRYPTO_DEFI_STAKE:   'bg-purple-800/60 text-purple-300',
  CRYPTO_DEFI_LENDING: 'bg-violet-900/60 text-violet-300',
  CASH_ARS:            'bg-slate-700 text-slate-400',
  CASH_USD_MEP:        'bg-slate-700 text-slate-400',
  CASH_USD_CCL:        'bg-slate-700 text-slate-400',
  CASH_CRYPTO_STABLE:  'bg-slate-700 text-slate-400',
  CASH_CRYPTO_NATIVE:  'bg-slate-700 text-slate-400',
}

const CRYPTO_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_CRYPTO_NATIVE', 'CASH_CRYPTO_STABLE',
]

function isCrypto(type: AssetType | null): boolean {
  return type != null && CRYPTO_TYPES.includes(type)
}

function formatQty(pos: Position): string {
  if (pos.quantity_held == null) return '—'
  const qty = new Decimal(pos.quantity_held)
  return isCrypto(pos.asset_type) ? formatCrypto(qty) : qty.toFixed(2)
}

function formatPrice(pos: Position): string {
  if (pos.current_price == null) return '—'
  const p = new Decimal(pos.current_price)
  if (isCrypto(pos.asset_type)) return formatUSD(p)
  return formatARS(p)
}

function formatPPP(pos: Position): string {
  if (pos.ppp_ars == null) return '—'
  return formatARS(new Decimal(pos.ppp_ars))
}

function formatBreakEven(pos: Position): { price: string; pct: string; above: boolean } | null {
  if (pos.break_even_price_ars == null) return null
  const price = formatARS(new Decimal(pos.break_even_price_ars))
  if (pos.spread_vs_breakeven_pct == null) return { price, pct: '—', above: true }
  const above = pos.spread_vs_breakeven_pct >= 0
  const pct   = formatPct(new Decimal(pos.spread_vs_breakeven_pct))
  return { price, pct, above }
}

function getPnLContext(pos: Position): { msg: string; color: string } | null {
  const pnlARS = pos.unrealized_pnl_ars ?? 0
  const pnlUSD = pos.unrealized_pnl_usd ?? 0
  if (Math.abs(pnlARS) < 0.01 && Math.abs(pnlUSD) < 0.01) return null
  if (pnlARS > 0 && pnlUSD < 0)
    return { msg: '⚠ Ganancia en ARS por devaluación. En USD: pérdida.', color: 'text-amber-400' }
  if (pnlARS > 0 && pnlUSD > 0)
    return { msg: '✓ Ganancia real en ARS y USD', color: 'text-emerald-500' }
  if (pnlARS < 0 && pnlUSD < 0)
    return { msg: '✗ Pérdida en ARS y USD', color: 'text-red-400' }
  if (pnlARS < 0 && pnlUSD > 0)
    return { msg: '⚠ Pérdida en ARS por apreciación. En USD: ganancia.', color: 'text-amber-400' }
  return null
}

const DETALLE_TOOLTIP = `P&L ARS = Ganancia de precio + Ganancia cambiaria

Ganancia de precio: el activo subió/bajó de valor en dólares reales.

Ganancia cambiaria: el peso se devaluó desde que compraste, haciendo que tu inversión valga más en pesos aunque el activo no haya subido.

Para saber si realmente ganaste, mirá el P&L USD.`

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <Info className="h-3 w-3 text-slate-500 cursor-help ml-1 flex-shrink-0" />
      <span className="
        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg
        bg-slate-700 text-slate-200 text-xs leading-relaxed font-normal normal-case tracking-normal
        opacity-0 group-hover:opacity-100 pointer-events-none z-50
        whitespace-pre-wrap shadow-xl border border-slate-600
        transition-opacity duration-150
      ">
        {text}
      </span>
    </span>
  )
}

const HOY_TOOLTIP = `Variación del día vs. cierre anterior.
Equivalente al indicador 1D de tu broker.

Muestra cuánto ganó o perdió cada posición
solo en el día de hoy, sin considerar el
costo de compra original.`

const PNL_VIEWS = ['ARS', 'HOY', 'USD', 'DETALLE'] as const

const TYPE_ORDER: Partial<Record<AssetType, number>> = {
  BONO_SOBERANO:       1,
  BONO_SUBSOBERANO:    2,
  ON:                  3,
  LETES:               4,
  LECAP:               5,
  ACCION_LOCAL:        6,
  CEDEAR:              7,
  FCI_MONEY_MARKET:    8,
  FCI_RENTA_FIJA:      9,
  FCI_RENTA_VARIABLE:  10,
  FCI_RENTA_MIXTA:     11,
  CRYPTO_SPOT:         12,
  CRYPTO_STABLECOIN:   13,
  CRYPTO_EARN:         14,
  CRYPTO_DEFI_LP:      15,
  CRYPTO_DEFI_STAKE:   16,
  CRYPTO_DEFI_LENDING: 17,
  CASH_ARS:            18,
  CASH_USD_MEP:        19,
  CASH_USD_CCL:        20,
}

const FILTER_GROUPS: { label: string; types: AssetType[] }[] = [
  {
    label: 'Renta Variable',
    types: ['ACCION_LOCAL', 'CEDEAR', 'FCI_RENTA_VARIABLE', 'FCI_RENTA_MIXTA'],
  },
  {
    label: 'Renta Fija',
    types: ['BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP', 'FCI_RENTA_FIJA', 'FCI_MONEY_MARKET'],
  },
  {
    label: 'Crypto',
    types: ['CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN', 'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING'],
  },
  {
    label: 'Cash',
    types: ['CASH_ARS', 'CASH_USD_MEP', 'CASH_USD_CCL', 'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE'],
  },
]

export default function PositionsTable({ portfolioId, positions, baseCurrency = 'ARS', totalAUM }: PositionsTableProps) {
  const router = useRouter()
  const [activeGroup, setActiveGroup]         = useState<string | null>(null)
  const [txDialogOpen, setTxDialogOpen]       = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>()
  const [selectedTicker, setSelectedTicker]   = useState<string | undefined>()
  const [pnlView, setPnlView]                 = usePnLView()

  const isUsdBase = ['USDT', 'USD_MEP', 'USD_CCL'].includes(baseCurrency)

  function openTxFor(pos: Position) {
    setSelectedAssetId(pos.asset_id ?? undefined)
    setSelectedTicker(pos.ticker ?? undefined)
    setTxDialogOpen(true)
  }

  const filtered = (activeGroup
    ? positions.filter(p =>
        FILTER_GROUPS.find(g => g.label === activeGroup)?.types.includes(p.asset_type as AssetType)
      )
    : positions
  ).slice().sort((a, b) => {
    const orderA = TYPE_ORDER[a.asset_type as AssetType] ?? 99
    const orderB = TYPE_ORDER[b.asset_type as AssetType] ?? 99
    if (orderA !== orderB) return orderA - orderB
    return isUsdBase
      ? (b.market_value_usd ?? 0) - (a.market_value_usd ?? 0)
      : (b.market_value_ars ?? 0) - (a.market_value_ars ?? 0)
  })

  const colSpan = pnlView === 'DETALLE' ? 13 : 12

  const totalPortfolioAUM = totalAUM ?? positions.reduce((s, p) => s + (p.market_value_ars ?? 0), 0)
  const maxPct = filtered.length > 0 && totalPortfolioAUM > 0
    ? Math.max(...filtered.map(p => (p.market_value_ars ?? 0) / totalPortfolioAUM * 100))
    : 1

  const groups: { type: AssetType | null; label: string; positions: typeof filtered }[] = []
  for (const pos of filtered) {
    const t = pos.asset_type as AssetType | null
    const last = groups[groups.length - 1]
    if (!last || last.type !== t) {
      groups.push({ type: t, label: t ? (ASSET_LABELS[t] ?? t) : '—', positions: [pos] })
    } else {
      last.positions.push(pos)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros + Toggle P&L */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={activeGroup === null ? 'default' : 'outline'}
            onClick={() => setActiveGroup(null)}
            className={activeGroup === null
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}
          >
            Todos ({positions.length})
          </Button>
          {FILTER_GROUPS.map(g => {
            const count = positions.filter(p =>
              g.types.includes(p.asset_type as AssetType)
            ).length
            if (count === 0) return null
            const active = activeGroup === g.label
            return (
              <Button
                key={g.label}
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => setActiveGroup(active ? null : g.label)}
                className={active
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}
              >
                {g.label} ({count})
              </Button>
            )
          })}
        </div>

        {/* Toggle de vista P&L */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">P&L:</span>
          {PNL_VIEWS.map(v => (
            <Button
              key={v}
              size="sm"
              onClick={() => setPnlView(v)}
              className={pnlView === v
                ? 'h-7 text-xs px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'h-7 text-xs px-2.5 border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 bg-transparent'
              }
            >
              {v === 'DETALLE' ? 'Detalle' : v === 'HOY' ? 'Hoy 1D' : v === 'ARS' ? 'Total ARS' : v}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-800/80">
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Ticker</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Nombre</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Cantidad</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">{isUsdBase ? 'PPP USD' : 'PPP ARS'}</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Precio actual</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">{isUsdBase ? 'Valor USD' : 'Valor ARS'}</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">% Cartera</TableHead>

              {pnlView === 'ARS' && (
                <>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">P&L Total</TableHead>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">%</TableHead>
                </>
              )}
              {pnlView === 'HOY' && (
                <>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">
                    <span className="inline-flex items-center justify-end">
                      Hoy (1D)
                      <InfoTooltip text={HOY_TOOLTIP} />
                    </span>
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">%</TableHead>
                </>
              )}
              {pnlView === 'USD' && (
                <>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">P&L USD</TableHead>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">%</TableHead>
                </>
              )}
              {pnlView === 'DETALLE' && (
                <>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">
                    <span className="inline-flex items-center justify-end">
                      P&L ARS
                      <InfoTooltip text={DETALLE_TOOLTIP} />
                    </span>
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right whitespace-nowrap">
                    Del cual: FX
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right whitespace-nowrap">
                    Del cual: Precio
                  </TableHead>
                </>
              )}

              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Break-even</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-slate-500 py-10">
                  Sin posiciones
                </TableCell>
              </TableRow>
            ) : (
              groups.flatMap((group, gi) => {
                const groupValueARS = group.positions.reduce((s, p) => s + (p.market_value_ars ?? 0), 0)
                const groupPct      = totalPortfolioAUM > 0 ? groupValueARS / totalPortfolioAUM * 100 : 0
                const rightSpan     = pnlView === 'DETALLE' ? 5 : 4
                return [
                  ...group.positions.map((pos, i) => {
                    const pnlARS    = new Decimal(pos.unrealized_pnl_ars ?? 0)
                    const pnlPct    = new Decimal(pos.unrealized_pnl_ars_pct ?? 0)
                    const pnlUSD    = new Decimal(pos.unrealized_pnl_usd ?? 0)
                    const costUSD   = new Decimal(pos.total_cost_basis_usd ?? 0)
                    const pnlUsdPct = costUSD.gt(0) ? pnlUSD.div(costUSD) : new Decimal(0)
                    const fxGain    = new Decimal(pos.fx_gain_loss_ars ?? 0)
                    const priceGain = new Decimal(pos.price_gain_loss_ars ?? 0)
                    const context   = pnlView === 'DETALLE' ? getPnLContext(pos) : null

                    const dailyPnl    = pos.daily_pnl_ars    != null ? new Decimal(pos.daily_pnl_ars)    : null
                    const dailyChgPct = pos.daily_change_pct != null ? new Decimal(pos.daily_change_pct) : null

                    const arsColor   = pnlARS.gte(0) ? 'text-emerald-400' : 'text-red-400'
                    const usdColor   = pnlUSD.gte(0) ? 'text-emerald-400' : 'text-red-400'
                    const fxColor    = fxGain.gte(0) ? 'text-amber-400' : 'text-slate-400'
                    const priceColor = priceGain.gte(0) ? 'text-emerald-400' : 'text-red-400'
                    const hoyColor   = dailyPnl == null ? 'text-slate-500' : dailyPnl.gte(0) ? 'text-emerald-400' : 'text-red-400'
                    const badgeClass = ASSET_COLOR[pos.asset_type as AssetType] ?? 'bg-slate-700 text-slate-400'
                    const be         = formatBreakEven(pos)
                    const pctCartera = totalPortfolioAUM > 0 ? (pos.market_value_ars ?? 0) / totalPortfolioAUM * 100 : 0
                    const barCartera = maxPct > 0 ? pctCartera / maxPct * 100 : 0

                    return (
                      <TableRow
                        key={`${pos.asset_id}-${gi}-${i}`}
                        className="border-slate-700/50 hover:bg-slate-800/60"
                      >
                        <TableCell className="font-mono font-semibold text-white">
                          {pos.ticker ?? '—'}
                        </TableCell>
                        <TableCell className="text-slate-300 max-w-[180px] truncate" title={pos.asset_name ?? undefined}>
                          {pos.asset_name ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs border-0 ${badgeClass}`}>
                            {pos.asset_type ? ASSET_LABELS[pos.asset_type as AssetType] : '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {formatQty(pos)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-400 text-sm">
                          {isUsdBase
                            ? (pos.ppp_usd != null ? formatUSD(new Decimal(pos.ppp_usd)) : '—')
                            : formatPPP(pos)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-200">
                          {formatPrice(pos)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-white">
                          {isUsdBase
                            ? (pos.market_value_usd != null ? formatUSD(new Decimal(pos.market_value_usd)) : '—')
                            : (pos.market_value_ars != null ? formatARS(new Decimal(pos.market_value_ars)) : '—')}
                        </TableCell>
                        <TableCell className="text-right min-w-[68px]">
                          <div className="font-mono text-slate-200 text-xs tabular-nums">{pctCartera.toFixed(1)}%</div>
                          <div className="mt-0.5 h-0.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-400/60 transition-all" style={{ width: `${barCartera}%` }} />
                          </div>
                        </TableCell>

                        {pnlView === 'ARS' && (
                          <>
                            <TableCell className={`text-right font-mono font-semibold ${arsColor}`}>
                              {formatARS(pnlARS)}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-sm ${arsColor}`}>
                              {formatPct(pnlPct)}
                            </TableCell>
                          </>
                        )}
                        {pnlView === 'HOY' && (
                          <>
                            <TableCell className={`text-right font-mono font-semibold ${hoyColor}`}>
                              {dailyPnl != null ? formatARS(dailyPnl) : '—'}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-sm ${hoyColor}`}>
                              {dailyChgPct != null ? formatPct(dailyChgPct) : '—'}
                            </TableCell>
                          </>
                        )}
                        {pnlView === 'USD' && (
                          <>
                            <TableCell className={`text-right font-mono font-semibold ${usdColor}`}>
                              {formatUSD(pnlUSD)}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-sm ${usdColor}`}>
                              {formatPct(pnlUsdPct)}
                            </TableCell>
                          </>
                        )}
                        {pnlView === 'DETALLE' && (
                          <>
                            {/* P&L ARS total + contexto */}
                            <TableCell className="text-right">
                              <div className={`font-mono font-semibold text-sm ${arsColor}`}>
                                {formatARS(pnlARS)}
                              </div>
                              <div className={`font-mono text-xs ${arsColor}`}>
                                {formatPct(pnlPct)}
                              </div>
                              {context && (
                                <div className={`text-[10px] mt-0.5 leading-tight ${context.color}`}>
                                  {context.msg}
                                </div>
                              )}
                            </TableCell>
                            {/* Ganancia cambiaria */}
                            <TableCell className="text-right">
                              <div className={`font-mono text-xs ${fxColor}`}>
                                {formatARS(fxGain)}
                              </div>
                              <div className="text-[10px] text-slate-600">devaluación</div>
                            </TableCell>
                            {/* Ganancia de precio pura */}
                            <TableCell className="text-right">
                              <div className={`font-mono text-xs ${priceColor}`}>
                                {formatARS(priceGain)}
                              </div>
                              <div className="text-[10px] text-slate-600">precio real</div>
                            </TableCell>
                          </>
                        )}

                        <TableCell className="text-right">
                          {be ? (
                            <div>
                              <div className="font-mono text-slate-400 text-xs">{be.price}</div>
                              <div className={`font-mono text-xs ${be.above ? 'text-emerald-400' : 'text-red-400'}`}>
                                {be.above ? '▲ ' : '▼ '}{be.pct}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openTxFor(pos)}
                            className="text-xs border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                          >
                            + Tx
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  }),
                  <TableRow
                    key={`sub-${group.type ?? gi}`}
                    className="bg-slate-800/40 border-t border-slate-600/60"
                  >
                    <TableCell colSpan={6} className="text-slate-400 text-[11px] py-2 pl-4 font-semibold uppercase tracking-wider">
                      Total {group.label} · {group.positions.length} posición{group.positions.length !== 1 ? 'es' : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-slate-300 py-2">
                      {formatARS(new Decimal(groupValueARS))}
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <div className="font-mono text-xs text-slate-300 tabular-nums">{groupPct.toFixed(1)}%</div>
                      <div className="mt-0.5 h-0.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400/40 transition-all" style={{ width: `${maxPct > 0 ? (groupPct / maxPct) * 100 : 0}%` }} />
                      </div>
                    </TableCell>
                    <TableCell colSpan={rightSpan} />
                  </TableRow>,
                ]
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TransactionDialog
        portfolioId={portfolioId}
        defaultAssetId={selectedAssetId}
        defaultAssetTicker={selectedTicker}
        open={txDialogOpen}
        onOpenChange={setTxDialogOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
