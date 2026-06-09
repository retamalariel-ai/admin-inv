'use client'

import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import { Download, ArrowUpDown } from 'lucide-react'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatARS, formatUSD, formatPct } from '@/lib/utils/calculations'
import { downloadCSV } from '@/lib/utils/csv'
import { usePnLView } from '@/hooks/usePnLView'
import BondDetail from './BondDetail'
import type { Database } from '@/types/database.types'

type Position  = Database['public']['Views']['portfolio_valuation_unified']['Row']
type AssetType = Database['public']['Enums']['asset_type']

const RENTA_VARIABLE: AssetType[] = ['ACCION_LOCAL', 'CEDEAR']
const RENTA_FIJA: AssetType[]     = ['BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP']
const FONDOS: AssetType[]         = ['FCI_MONEY_MARKET', 'FCI_RENTA_FIJA', 'FCI_RENTA_VARIABLE', 'FCI_RENTA_MIXTA']
const BOND_TYPES: AssetType[]     = ['BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP']

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
  CRYPTO_SPOT:         'Crypto',
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
  ACCION_LOCAL:       'bg-blue-900/60 text-blue-300',
  CEDEAR:             'bg-indigo-900/60 text-indigo-300',
  BONO_SOBERANO:      'bg-amber-900/60 text-amber-300',
  BONO_SUBSOBERANO:   'bg-orange-900/60 text-orange-300',
  ON:                 'bg-violet-900/60 text-violet-300',
  LETES:              'bg-rose-900/60 text-rose-300',
  LECAP:              'bg-pink-900/60 text-pink-300',
  FCI_MONEY_MARKET:   'bg-teal-900/60 text-teal-300',
  FCI_RENTA_FIJA:     'bg-cyan-900/60 text-cyan-300',
  FCI_RENTA_VARIABLE: 'bg-sky-900/60 text-sky-300',
  FCI_RENTA_MIXTA:    'bg-slate-700/60 text-slate-300',
}

const D = (v: number | null) => new Decimal(v ?? 0)

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
  | 'quantity_held' | 'ppp_ars' | 'current_price' | 'market_value_ars'
  | 'market_value_usd' | 'unrealized_pnl_ars' | 'unrealized_pnl_ars_pct'

interface Props {
  positions:    Position[]
  cedearRatios: Record<string, number>
}

const PNL_VIEWS = ['ARS', 'USD', 'DETALLE'] as const

export default function CMDashboard({ positions, cedearRatios }: Props) {
  const [tab,     setTab]     = useState<'all' | 'rv' | 'rf' | 'fci'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('market_value_ars')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [pnlView, setPnlView] = usePnLView()

  const filtered = useMemo(() => {
    if (tab === 'rv')  return positions.filter(p => RENTA_VARIABLE.includes(p.asset_type as AssetType))
    if (tab === 'rf')  return positions.filter(p => RENTA_FIJA.includes(p.asset_type as AssetType))
    if (tab === 'fci') return positions.filter(p => FONDOS.includes(p.asset_type as AssetType))
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

  // Métricas
  const aum      = filtered.reduce((s, p) => s.plus(D(p.market_value_ars)), new Decimal(0))
  const aumUsd   = filtered.reduce((s, p) => s.plus(D(p.market_value_usd)), new Decimal(0))
  const pnlUnr   = filtered.reduce((s, p) => s.plus(D(p.unrealized_pnl_ars)), new Decimal(0))
  const pnlReal  = filtered.reduce((s, p) => s.plus(D(p.realized_gain_loss_ars)), new Decimal(0))

  function handleExport() {
    const rows = sorted.map(p => ({
      Cliente:           p.client_name ?? '',
      Portfolio:         p.portfolio_name ?? '',
      Ticker:            p.ticker ?? '',
      Nombre:            p.asset_name ?? '',
      Tipo:              p.asset_type ? ASSET_LABELS[p.asset_type as AssetType] : '',
      Cantidad:          p.quantity_held ?? '',
      PPP_ARS:           p.ppp_ars ?? '',
      Precio_Actual:     p.current_price ?? '',
      Mkt_Val_ARS:       p.market_value_ars ?? '',
      Mkt_Val_USD:       p.market_value_usd ?? '',
      PnL_ARS:           p.unrealized_pnl_ars ?? '',
      PnL_pct:           p.unrealized_pnl_ars_pct ?? '',
      Realizado_ARS:     p.realized_gain_loss_ars ?? '',
      VN_Efectivo:       BOND_TYPES.includes(p.asset_type as AssetType)
        ? D(p.quantity_held).mul(D(p.current_residual_factor)).toFixed(2)
        : '',
      Residual_Factor:   BOND_TYPES.includes(p.asset_type as AssetType)
        ? p.current_residual_factor ?? ''
        : '',
    }))
    downloadCSV(`capital-markets-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  const isBond = (p: Position) => BOND_TYPES.includes(p.asset_type as AssetType)
  const isCEDEAR = (p: Position) => p.asset_type === 'CEDEAR'

  function cclImplicito(p: Position): string {
    if (!isCEDEAR(p)) return '—'
    const ratio = cedearRatios[p.ticker ?? '']
    if (!ratio || !p.current_price || !p.ppp_usd) return '—'
    const ccl = D(p.current_price).div(D(p.ppp_usd).mul(new Decimal(ratio)))
    return formatARS(ccl)
  }

  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${className}`}
      onClick={() => handleSort(k)}
    >
      {children}<SortIcon k={k} />
    </TableHead>
  )

  const pnlClass = (v: number | null) =>
    (v ?? 0) >= 0 ? 'text-emerald-400 tabular-nums' : 'text-red-400 tabular-nums'

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="AUM TradFi ARS"    value={formatARS(aum)} />
        <MetricCard label="AUM TradFi USD"    value={formatUSD(aumUsd)} />
        <MetricCard
          label="P&L No Realizado ARS"
          value={formatARS(pnlUnr)}
          sub={pnlUnr.gte(0) ? '▲ positivo' : '▼ negativo'}
        />
        <MetricCard label="P&L Realizado ARS" value={formatARS(pnlReal)} />
      </div>

      {/* Tabs + Toggle P&L + Export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList className="bg-slate-800">
            <TabsTrigger value="all">Todos ({positions.length})</TabsTrigger>
            <TabsTrigger value="rv">
              RV ({positions.filter(p => RENTA_VARIABLE.includes(p.asset_type as AssetType)).length})
            </TabsTrigger>
            <TabsTrigger value="rf">
              RF ({positions.filter(p => RENTA_FIJA.includes(p.asset_type as AssetType)).length})
            </TabsTrigger>
            <TabsTrigger value="fci">
              FCI ({positions.filter(p => FONDOS.includes(p.asset_type as AssetType)).length})
            </TabsTrigger>
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
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 ml-2">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-slate-700 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <Th k="client_name">Cliente</Th>
              <Th k="portfolio_name">Portfolio</Th>
              <Th k="ticker">Ticker</Th>
              <Th k="asset_name">Nombre</Th>
              <Th k="asset_type">Tipo</Th>
              <Th k="quantity_held" className="text-right">Cantidad</Th>
              <Th k="ppp_ars" className="text-right">PPP ARS</Th>
              <Th k="current_price" className="text-right">Precio</Th>
              <Th k="market_value_ars" className="text-right">Mkt Val ARS</Th>
              <Th k="market_value_usd" className="text-right">Mkt Val USD</Th>
              {pnlView === 'ARS' && (
                <>
                  <Th k="unrealized_pnl_ars" className="text-right">P&L ARS</Th>
                  <Th k="unrealized_pnl_ars_pct" className="text-right">%</Th>
                </>
              )}
              {pnlView === 'USD' && (
                <>
                  <TableHead className="text-right whitespace-nowrap cursor-default">P&L USD</TableHead>
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
              <TableHead className="text-right whitespace-nowrap">VN / CCL Impl.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={pnlView === 'DETALLE' ? 14 : 13} className="text-center text-slate-500 py-12">
                  Sin posiciones
                </TableCell>
              </TableRow>
            )}
            {sorted.map((p, i) => (
              <TableRow key={`${p.portfolio_id}-${p.asset_id}-${i}`}
                className="border-slate-700 hover:bg-slate-800/50">
                <TableCell className="text-slate-300 whitespace-nowrap">{p.client_name ?? '—'}</TableCell>
                <TableCell className="text-slate-400 whitespace-nowrap text-xs">{p.portfolio_name ?? '—'}</TableCell>
                <TableCell className="font-mono font-semibold text-slate-100">{p.ticker ?? '—'}</TableCell>
                <TableCell className="text-slate-300 max-w-[180px] truncate text-xs">
                  {p.asset_name ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${ASSET_COLOR[p.asset_type as AssetType] ?? 'bg-slate-700 text-slate-300'}`}>
                    {p.asset_type ? ASSET_LABELS[p.asset_type as AssetType] : '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-300">
                  {p.quantity_held != null ? Number(p.quantity_held).toLocaleString('es-AR') : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-300">
                  {p.ppp_ars != null ? formatARS(D(p.ppp_ars)) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-300">
                  {p.current_price != null ? formatARS(D(p.current_price)) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-100 font-medium">
                  {p.market_value_ars != null ? formatARS(D(p.market_value_ars)) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-300">
                  {p.market_value_usd != null ? formatUSD(D(p.market_value_usd)) : '—'}
                </TableCell>
                {pnlView === 'ARS' && (
                  <>
                    <TableCell className={`text-right ${pnlClass(p.unrealized_pnl_ars)}`}>
                      {p.unrealized_pnl_ars != null ? formatARS(D(p.unrealized_pnl_ars)) : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${pnlClass(p.unrealized_pnl_ars_pct)}`}>
                      {p.unrealized_pnl_ars_pct != null ? formatPct(D(p.unrealized_pnl_ars_pct)) : '—'}
                    </TableCell>
                  </>
                )}
                {pnlView === 'USD' && (
                  <>
                    <TableCell className={`text-right ${pnlClass(p.unrealized_pnl_usd)}`}>
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
                    <TableCell className={`text-right ${pnlClass(p.unrealized_pnl_ars)}`}>
                      <div>{p.unrealized_pnl_ars != null ? formatARS(D(p.unrealized_pnl_ars)) : '—'}</div>
                      <div className="text-xs">
                        {p.unrealized_pnl_ars_pct != null ? formatPct(D(p.unrealized_pnl_ars_pct)) : ''}
                      </div>
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
                <TableCell className="text-right">
                  {isBond(p)
                    ? <BondDetail quantityHeld={p.quantity_held} residualFactor={p.current_residual_factor} />
                    : <span className="text-slate-500 text-xs">{cclImplicito(p)}</span>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-slate-600 text-right">
        {sorted.length} posiciones · ordenado por {sortKey} {sortDir}
      </p>
    </div>
  )
}
