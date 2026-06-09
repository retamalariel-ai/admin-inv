'use client'

import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import { Download, ArrowUpDown } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatUSD, formatARS, formatPct, formatCrypto } from '@/lib/utils/calculations'
import { downloadCSV } from '@/lib/utils/csv'
import { usePnLView } from '@/hooks/usePnLView'
import EarnTracker from './EarnTracker'
import type { Database } from '@/types/database.types'

type Position  = Database['public']['Views']['portfolio_valuation_unified']['Row']
type AssetType = Database['public']['Enums']['asset_type']

const SPOT_TYPES: AssetType[]  = ['CRYPTO_SPOT', 'CRYPTO_STABLECOIN']
const EARN_TYPES: AssetType[]  = ['CRYPTO_EARN']
const DEFI_TYPES: AssetType[]  = ['CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING']
const CASH_TYPES: AssetType[]  = ['CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE']

const ASSET_LABELS: Record<AssetType, string> = {
  ACCION_LOCAL:        'Acción',
  CEDEAR:              'CEDEAR',
  BONO_SOBERANO:       'Bono Sob.',
  BONO_SUBSOBERANO:    'Bono Sub.',
  ON:                  'ON',
  LETES:               'LETES',
  LECAP:               'LECAP',
  FCI_MONEY_MARKET:    'FCI MM',
  FCI_RENTA_FIJA:      'FCI RF',
  FCI_RENTA_VARIABLE:  'FCI RV',
  FCI_RENTA_MIXTA:     'FCI Mix',
  CRYPTO_SPOT:         'Spot',
  CRYPTO_STABLECOIN:   'Stable',
  CRYPTO_EARN:         'Earn',
  CRYPTO_DEFI_LP:      'DeFi LP',
  CRYPTO_DEFI_STAKE:   'Stake',
  CRYPTO_DEFI_LENDING: 'Lending',
  CASH_ARS:            'Cash ARS',
  CASH_USD_MEP:        'Cash USD',
  CASH_USD_CCL:        'Cash CCL',
  CASH_CRYPTO_STABLE:  'Cash Stbl',
  CASH_CRYPTO_NATIVE:  'Cash Nat.',
}

const ASSET_COLOR: Partial<Record<AssetType, string>> = {
  CRYPTO_SPOT:         'bg-orange-900/60 text-orange-300',
  CRYPTO_STABLECOIN:   'bg-green-900/60 text-green-300',
  CRYPTO_EARN:         'bg-emerald-900/60 text-emerald-300',
  CRYPTO_DEFI_LP:      'bg-purple-900/60 text-purple-300',
  CRYPTO_DEFI_STAKE:   'bg-violet-900/60 text-violet-300',
  CRYPTO_DEFI_LENDING: 'bg-indigo-900/60 text-indigo-300',
  CASH_CRYPTO_STABLE:  'bg-teal-900/60 text-teal-300',
  CASH_CRYPTO_NATIVE:  'bg-slate-700/60 text-slate-300',
}

const NET_COLOR: Partial<Record<AssetType, string>> = {
  CRYPTO_SPOT:         'bg-blue-900/40 text-blue-400',
  CRYPTO_EARN:         'bg-emerald-900/40 text-emerald-400',
  CRYPTO_DEFI_STAKE:   'bg-violet-900/40 text-violet-400',
  CRYPTO_DEFI_LP:      'bg-purple-900/40 text-purple-400',
}

const D = (v: number | null) => new Decimal(v ?? 0)

function daysHeld(firstPurchase: string | null, today: string): number {
  if (!firstPurchase) return 0
  return Math.max(1, Math.floor(
    (new Date(today).getTime() - new Date(firstPurchase).getTime()) / 86_400_000,
  ))
}

function calcAPY(position: Position, today: string): string {
  const income = D(position.total_income_received_usd)
  const cost   = D(position.total_cost_basis_usd)
  const days   = daysHeld(position.first_purchase_date, today)
  if (cost.isZero() || days === 0) return '—'
  return `${income.div(cost).mul(new Decimal(365 / days)).mul(100).toFixed(2)}%`
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-semibold text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

type SortKey = 'client_name' | 'portfolio_name' | 'ticker' | 'asset_name' | 'asset_type'
  | 'blockchain_network' | 'quantity_held' | 'ppp_usd' | 'current_price'
  | 'market_value_usd' | 'market_value_ars' | 'unrealized_pnl_usd'
  | 'total_income_received_usd'

type TabValue = 'all' | 'spot' | 'earn' | 'defi' | 'cash'

interface Props {
  positions: Position[]
  today:     string
}

const PNL_VIEWS = ['ARS', 'USD', 'DETALLE'] as const

export default function CryptoDashboard({ positions, today }: Props) {
  const [tab,     setTab]     = useState<TabValue>('all')
  const [sortKey, setSortKey] = useState<SortKey>('market_value_usd')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEarn, setShowEarn] = useState(false)
  const [pnlView, setPnlView] = usePnLView()

  const filtered = useMemo(() => {
    if (tab === 'spot') return positions.filter(p => SPOT_TYPES.includes(p.asset_type as AssetType))
    if (tab === 'earn') return positions.filter(p => EARN_TYPES.includes(p.asset_type as AssetType))
    if (tab === 'defi') return positions.filter(p => DEFI_TYPES.includes(p.asset_type as AssetType))
    if (tab === 'cash') return positions.filter(p => CASH_TYPES.includes(p.asset_type as AssetType))
    return positions
  }, [positions, tab])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      const cmp = typeof av === 'string'
        ? (av as string).localeCompare(bv as string, 'es-AR')
        : (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 text-slate-600 inline ml-1" />
    return <span className="ml-1 text-emerald-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Métricas sobre todas las posiciones
  const aumUsd  = positions.reduce((s, p) => s.plus(D(p.market_value_usd)), new Decimal(0))
  const aumArs  = positions.reduce((s, p) => s.plus(D(p.market_value_ars)), new Decimal(0))
  const income  = positions.reduce((s, p) => s.plus(D(p.total_income_received_usd)), new Decimal(0))
  const pnlUnr  = positions.reduce((s, p) => s.plus(D(p.unrealized_pnl_usd)), new Decimal(0))

  function handleExport() {
    const rows = sorted.map(p => ({
      Cliente:     p.client_name ?? '',
      Portfolio:   p.portfolio_name ?? '',
      Token:       p.ticker ?? '',
      Nombre:      p.asset_name ?? '',
      Red:         p.blockchain_network ?? '',
      Tipo:        p.asset_type ? ASSET_LABELS[p.asset_type as AssetType] : '',
      Cantidad:    p.quantity_held ?? '',
      PPP_USD:     p.ppp_usd ?? '',
      Precio_USD:  p.current_price ?? '',
      Mkt_Val_USD: p.market_value_usd ?? '',
      Mkt_Val_ARS: p.market_value_ars ?? '',
      PnL_USD:     p.unrealized_pnl_usd ?? '',
      Income_USD:  p.total_income_received_usd ?? '',
      APY:         calcAPY(p, today),
    }))
    downloadCSV(`crypto-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const isCrypto = (p: Position) => D(p.quantity_held).gt(0)
  const pnlClass = (v: number | null) =>
    (v ?? 0) >= 0 ? 'text-emerald-400 tabular-nums' : 'text-red-400 tabular-nums'

  const earnCount = positions.filter(p =>
    [...EARN_TYPES, ...DEFI_TYPES].includes(p.asset_type as AssetType)
  ).length

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => handleSort(k)}
    >
      {children}<SortIcon k={k} />
    </TableHead>
  )

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="AUM Crypto USD" value={formatUSD(aumUsd)} />
        <MetricCard label="AUM Crypto ARS" value={formatARS(aumArs)} />
        <MetricCard label="Yield/Income USD" value={formatUSD(income)} sub="acumulado" />
        <MetricCard
          label="P&L No Realizado USD"
          value={formatUSD(pnlUnr)}
          sub={pnlUnr.gte(0) ? '▲ positivo' : '▼ negativo'}
        />
      </div>

      {/* Tabs + Toggle P&L + botones */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Tabs value={tab} onValueChange={v => setTab(v as TabValue)}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="all">Todos ({positions.length})</TabsTrigger>
            <TabsTrigger value="spot">Spot ({positions.filter(p => SPOT_TYPES.includes(p.asset_type as AssetType)).length})</TabsTrigger>
            <TabsTrigger value="earn">Earn ({positions.filter(p => EARN_TYPES.includes(p.asset_type as AssetType)).length})</TabsTrigger>
            <TabsTrigger value="defi">DeFi ({positions.filter(p => DEFI_TYPES.includes(p.asset_type as AssetType)).length})</TabsTrigger>
            <TabsTrigger value="cash">Cash ({positions.filter(p => CASH_TYPES.includes(p.asset_type as AssetType)).length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">P&L:</span>
          {PNL_VIEWS.map(v => (
            <Button key={v} size="sm"
              onClick={() => setPnlView(v)}
              className={pnlView === v
                ? 'h-7 text-xs px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white'
                : 'h-7 text-xs px-2.5 border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700 bg-transparent'
              }
            >
              {v === 'DETALLE' ? 'Detalle' : v}
            </Button>
          ))}
          {earnCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowEarn(v => !v)} className="ml-2">
              {showEarn ? 'Ocultar' : 'Ver'} Earn
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Earn Tracker */}
      {showEarn && earnCount > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Earn / DeFi Tracker
          </h3>
          <EarnTracker positions={positions} today={today} />
        </div>
      )}

      {/* Tabla principal */}
      <div className="rounded-lg border border-slate-700 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <Th k="client_name">Cliente</Th>
              <Th k="portfolio_name">Portfolio</Th>
              <Th k="ticker">Token</Th>
              <Th k="asset_name">Nombre</Th>
              <Th k="blockchain_network">Red</Th>
              <Th k="asset_type">Tipo</Th>
              <Th k="quantity_held" className="text-right">Cantidad</Th>
              <Th k="ppp_usd" className="text-right">PPP USD</Th>
              <Th k="current_price" className="text-right">Precio USD</Th>
              <Th k="market_value_usd" className="text-right">Mkt Val USD</Th>
              <Th k="market_value_ars" className="text-right">Mkt Val ARS</Th>
              {pnlView === 'ARS' && (
                <>
                  <TableHead className="text-right whitespace-nowrap cursor-default">P&L ARS</TableHead>
                  <TableHead className="text-right cursor-default">%</TableHead>
                </>
              )}
              {pnlView === 'USD' && (
                <>
                  <Th k="unrealized_pnl_usd" className="text-right">P&L USD</Th>
                  <TableHead className="text-right cursor-default">%</TableHead>
                </>
              )}
              {pnlView === 'DETALLE' && (
                <>
                  <TableHead className="text-right whitespace-nowrap cursor-default">P&L ARS</TableHead>
                  <TableHead className="text-right whitespace-nowrap cursor-default">Del cual: FX</TableHead>
                  <TableHead className="text-right whitespace-nowrap cursor-default">Del cual: Precio</TableHead>
                </>
              )}
              <Th k="total_income_received_usd" className="text-right">Income USD</Th>
              <TableHead className="text-right whitespace-nowrap">APY est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={pnlView === 'DETALLE' ? 16 : 15} className="text-center text-slate-500 py-12">
                  Sin posiciones
                </TableCell>
              </TableRow>
            )}
            {sorted.map((p, i) => {
              const netColor = NET_COLOR[p.asset_type as AssetType]
              const hasIncome = (p.total_income_received_usd ?? 0) > 0
              const apy       = hasIncome ? calcAPY(p, today) : '—'

              return (
                <TableRow key={`${p.portfolio_id}-${p.asset_id}-${i}`}
                  className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-300 whitespace-nowrap text-sm">
                    {p.client_name ?? '—'}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                    {p.portfolio_name ?? '—'}
                    {p.custodian_name && (
                      <span className="block text-slate-600">{p.custodian_name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono font-semibold px-1.5 py-0.5 rounded text-sm ${netColor ?? 'text-slate-100'}`}>
                      {p.ticker ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-300 text-xs max-w-[140px] truncate">
                    {p.asset_name ?? '—'}
                  </TableCell>
                  <TableCell>
                    {p.blockchain_network && (
                      <Badge className="text-xs bg-slate-700/60 text-slate-300 capitalize">
                        {p.blockchain_network}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${ASSET_COLOR[p.asset_type as AssetType] ?? 'bg-slate-700 text-slate-300'}`}>
                      {p.asset_type ? ASSET_LABELS[p.asset_type as AssetType] : '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-300 text-xs">
                    {p.quantity_held != null ? formatCrypto(D(p.quantity_held)) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-400 text-xs">
                    {p.ppp_usd != null ? formatUSD(D(p.ppp_usd)) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-300">
                    {p.current_price != null ? formatUSD(D(p.current_price)) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-100 font-medium">
                    {p.market_value_usd != null ? formatUSD(D(p.market_value_usd)) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-400 text-xs">
                    {p.market_value_ars != null ? formatARS(D(p.market_value_ars)) : '—'}
                  </TableCell>
                  {pnlView === 'ARS' && (
                    <>
                      <TableCell className={`text-right text-xs ${pnlClass(p.unrealized_pnl_ars)}`}>
                        {p.unrealized_pnl_ars != null ? formatARS(D(p.unrealized_pnl_ars)) : '—'}
                      </TableCell>
                      <TableCell className={`text-right text-xs ${pnlClass(p.unrealized_pnl_ars_pct)}`}>
                        {p.unrealized_pnl_ars_pct != null ? formatPct(D(p.unrealized_pnl_ars_pct)) : '—'}
                      </TableCell>
                    </>
                  )}
                  {pnlView === 'USD' && (
                    <>
                      <TableCell className={`text-right text-xs ${pnlClass(p.unrealized_pnl_usd)}`}>
                        {p.unrealized_pnl_usd != null ? formatUSD(D(p.unrealized_pnl_usd)) : '—'}
                      </TableCell>
                      <TableCell className={`text-right text-xs ${pnlClass(p.unrealized_pnl_usd)}`}>
                        {p.total_cost_basis_usd && p.unrealized_pnl_usd != null
                          ? formatPct(D(p.unrealized_pnl_usd).div(D(p.total_cost_basis_usd)))
                          : '—'}
                      </TableCell>
                    </>
                  )}
                  {pnlView === 'DETALLE' && (
                    <>
                      <TableCell className={`text-right text-xs ${pnlClass(p.unrealized_pnl_ars)}`}>
                        <div>{p.unrealized_pnl_ars != null ? formatARS(D(p.unrealized_pnl_ars)) : '—'}</div>
                        <div>{p.unrealized_pnl_ars_pct != null ? formatPct(D(p.unrealized_pnl_ars_pct)) : ''}</div>
                      </TableCell>
                      <TableCell className={`text-right text-xs ${(p.fx_gain_loss_ars ?? 0) >= 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {p.fx_gain_loss_ars != null ? formatARS(D(p.fx_gain_loss_ars)) : '—'}
                        <div className="text-[10px] text-slate-600">devaluación</div>
                      </TableCell>
                      <TableCell className={`text-right text-xs ${pnlClass(p.price_gain_loss_ars)}`}>
                        {p.price_gain_loss_ars != null ? formatARS(D(p.price_gain_loss_ars)) : '—'}
                        <div className="text-[10px] text-slate-600">precio real</div>
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right tabular-nums text-emerald-400 text-xs">
                    {(p.total_income_received_usd ?? 0) > 0
                      ? formatUSD(D(p.total_income_received_usd))
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-400 text-xs font-medium">
                    {apy}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-600 text-right">
        {sorted.length} posiciones · ordenado por {sortKey} {sortDir}
      </p>
    </div>
  )
}
