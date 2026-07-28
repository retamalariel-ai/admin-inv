'use client'

import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatUSD, formatARS, formatCrypto } from '@/lib/utils/calculations'
import { downloadCSV } from '@/lib/utils/csv'
import EarnTracker, { type EarnPosition } from './EarnTracker'
import type { Database } from '@/types/database.types'

type Position  = Database['public']['Views']['portfolio_valuation_unified']['Row']
type AssetType = Database['public']['Enums']['asset_type']

// ── Public types ──────────────────────────────────────────────────────────────
export interface PortfolioGroup {
  portfolio: {
    id:             string
    name:           string
    custodian_name: string | null
    custodian_type: string
    base_currency:  string
  }
  positions:     Position[]
  earnPositions: EarnPosition[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ASSET_LABELS: Partial<Record<AssetType, string>> = {
  CRYPTO_SPOT:         'Spot',
  CRYPTO_STABLECOIN:   'Stable',
  CRYPTO_EARN:         'Earn',
  CRYPTO_DEFI_LP:      'DeFi LP',
  CRYPTO_DEFI_STAKE:   'Stake',
  CRYPTO_DEFI_LENDING: 'Lending',
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

const CUSTODIAN_BADGE: Record<string, { label: string; color: string }> = {
  ALYCE:         { label: 'ALyC',   color: 'bg-blue-900/60 text-blue-300' },
  EXCHANGE_CEX:  { label: 'CEX',    color: 'bg-orange-900/60 text-orange-300' },
  EARN_PLATFORM: { label: 'CeFi',   color: 'bg-emerald-900/60 text-emerald-300' },
  DEFI_PROTOCOL: { label: 'DeFi',   color: 'bg-purple-900/60 text-purple-300' },
  WALLET_HW:     { label: 'HW',     color: 'bg-slate-700/60 text-slate-300' },
  WALLET_SW:     { label: 'Wallet', color: 'bg-slate-700/60 text-slate-300' },
  OTRO:          { label: 'Otro',   color: 'bg-slate-700/60 text-slate-300' },
}

// Stablecoin / cash types that might be idle (no earn, no yield)
const IDLE_TYPES: AssetType[] = ['CRYPTO_STABLECOIN', 'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE']

const D = (v: number | null) => new Decimal(v ?? 0)

function daysAccruedEarn(startDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMoveToEarnUrl(ticker: string, custodianType: string): string | null {
  const t = ticker.toUpperCase()
  switch (custodianType) {
    case 'EXCHANGE_CEX':
      return 'https://www.binance.com/en/earn'
    case 'EARN_PLATFORM':
      return 'https://app.nexo.com/earn'
    case 'WALLET_HW':
    case 'WALLET_SW':
      if (['USDT', 'USDC', 'DAI', 'FRAX'].includes(t)) return 'https://app.morpho.org'
      if (t === 'ETH' || t === 'WETH')                  return 'https://app.morpho.org'
      return null
    default:
      return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean | null
}) {
  const valueColor = positive == null ? 'text-slate-100'
    : positive ? 'text-emerald-400' : 'text-red-400'
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function PositionMiniTable({ positions }: { positions: Position[] }) {
  const hasIncome = positions.some(p => (p.total_income_received_usd ?? 0) > 0)

  return (
    <div className="rounded-lg border border-slate-700/60 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead className="text-xs">Token</TableHead>
            <TableHead className="text-xs">Tipo</TableHead>
            <TableHead className="text-right text-xs">Cantidad</TableHead>
            <TableHead className="text-right text-xs">Precio USD</TableHead>
            <TableHead className="text-right text-xs">Valor USD</TableHead>
            <TableHead className="text-right text-xs">P&L USD</TableHead>
            {hasIncome && <TableHead className="text-right text-xs">Income</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 && (
            <TableRow>
              <TableCell colSpan={hasIncome ? 7 : 6} className="text-center text-slate-500 py-6 text-sm">
                Sin posiciones
              </TableCell>
            </TableRow>
          )}
          {positions.map((p, i) => {
            const pnl        = p.unrealized_pnl_usd ?? 0
            const pnlClass   = pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
            const cost       = D(p.total_cost_basis_usd)
            const pnlPct     = !cost.isZero()
              ? D(pnl).div(cost).mul(100).toFixed(1) + '%'
              : null

            return (
              <TableRow key={`${p.portfolio_id}-${p.asset_id}-${i}`}
                className="border-slate-700/60 hover:bg-slate-800/40">
                <TableCell>
                  <span className={`font-mono font-semibold text-sm px-1.5 py-0.5 rounded
                    ${ASSET_COLOR[p.asset_type as AssetType] ?? 'text-slate-100'}`}>
                    {p.ticker ?? '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge className={`text-xs ${ASSET_COLOR[p.asset_type as AssetType] ?? 'bg-slate-700 text-slate-300'}`}>
                    {ASSET_LABELS[p.asset_type as AssetType] ?? p.asset_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-300 text-xs">
                  {p.quantity_held != null ? formatCrypto(D(p.quantity_held)) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-400 text-xs">
                  {p.current_price != null ? formatUSD(D(p.current_price)) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-100 text-sm font-medium">
                  {p.market_value_usd != null ? formatUSD(D(p.market_value_usd)) : '—'}
                </TableCell>
                <TableCell className={`text-right tabular-nums text-xs ${pnlClass}`}>
                  {pnl !== 0 ? (
                    <>
                      <div>{formatUSD(D(pnl))}</div>
                      {pnlPct && <div className="text-[10px] opacity-70">{pnlPct}</div>}
                    </>
                  ) : '—'}
                </TableCell>
                {hasIncome && (
                  <TableCell className="text-right tabular-nums text-emerald-400 text-xs">
                    {(p.total_income_received_usd ?? 0) > 0
                      ? formatUSD(D(p.total_income_received_usd))
                      : '—'}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function IdleFundsWidget({ positions, custodianType }: {
  positions:     Position[]
  custodianType: string
}) {
  const idle = positions.filter(p =>
    IDLE_TYPES.includes(p.asset_type as AssetType) &&
    D(p.quantity_held).gt(0) &&
    (p.total_income_received_usd ?? 0) === 0,
  )
  if (idle.length === 0) return null

  const totalIdleUSD = idle.reduce((s, p) => s.plus(D(p.market_value_usd)), new Decimal(0))

  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Fondos sin rendimiento
          </span>
          <Badge className="bg-amber-900/50 text-amber-300 text-xs border-0">
            {idle.length} posición{idle.length !== 1 ? 'es' : ''}
          </Badge>
        </div>
        <span className="text-sm font-semibold tabular-nums text-amber-300">
          {formatUSD(totalIdleUSD)}
        </span>
      </div>
      <div className="space-y-2">
        {idle.map((p, i) => {
          const url = getMoveToEarnUrl(p.ticker ?? '', custodianType)
          return (
            <div key={`${p.asset_id}-${i}`} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-300">
                  {p.ticker ?? '—'}
                </span>
                <span className="tabular-nums text-slate-500 text-xs">
                  {p.quantity_held != null ? formatCrypto(D(p.quantity_held)) : '—'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-slate-200 text-xs font-medium">
                  {p.market_value_usd != null ? formatUSD(D(p.market_value_usd)) : '—'}
                </span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap transition-colors"
                  >
                    Mover a Earn →
                  </a>
                ) : (
                  <span className="text-xs text-slate-600 whitespace-nowrap">sin earn disponible</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PortfolioSection({ group }: { group: PortfolioGroup }) {
  const { portfolio, positions, earnPositions } = group
  const badge   = CUSTODIAN_BADGE[portfolio.custodian_type] ?? { label: portfolio.custodian_type, color: 'bg-slate-700 text-slate-300' }
  const earnAUM = earnPositions.reduce((s, ep) => s.plus(new Decimal(ep.principal_amount_usd ?? ep.principal_amount)), new Decimal(0))
  const aumUSD  = positions.reduce((s, p) => s.plus(D(p.market_value_usd)), new Decimal(0)).plus(earnAUM)
  const aumARS  = positions.reduce((s, p) => s.plus(D(p.market_value_ars)), new Decimal(0))

  // Sort: by market_value_usd desc
  const sorted = [...positions].sort((a, b) => D(b.market_value_usd).minus(D(a.market_value_usd)).toNumber())

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 overflow-hidden">
      {/* Portfolio header */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-800/60 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Badge className={`text-xs font-medium ${badge.color}`}>{badge.label}</Badge>
          <div>
            <p className="text-slate-100 font-semibold">{portfolio.name}</p>
            {portfolio.custodian_name && (
              <p className="text-xs text-slate-500">{portfolio.custodian_name}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-slate-100 font-semibold tabular-nums">{formatUSD(aumUSD)}</p>
          <p className="text-xs text-slate-500 tabular-nums">{formatARS(aumARS)}</p>
        </div>
      </div>

      {/* Positions table */}
      <div className="p-4 space-y-4">
        <PositionMiniTable positions={sorted} />

        <IdleFundsWidget positions={sorted} custodianType={portfolio.custodian_type} />

        {/* Earn tracker for this portfolio */}
        {earnPositions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Earn acumulado
            </p>
            <EarnTracker earnPositions={earnPositions} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props {
  portfolioGroups: PortfolioGroup[]
  today:           string
}

export default function CryptoDashboard({ portfolioGroups, today }: Props) {
  const allPositions     = useMemo(() => portfolioGroups.flatMap(g => g.positions),     [portfolioGroups])
  const allEarnPositions = useMemo(() => portfolioGroups.flatMap(g => g.earnPositions), [portfolioGroups])

  // Global metrics (earn AUM from principal_amount_usd calculated server-side)
  const aumUsd  = allPositions.reduce((s, p) => s.plus(D(p.market_value_usd)), new Decimal(0))
    .plus(allEarnPositions.reduce((s, ep) => s.plus(new Decimal(ep.principal_amount_usd ?? ep.principal_amount)), new Decimal(0)))
  const aumArs  = allPositions.reduce((s, p) => s.plus(D(p.market_value_ars)), new Decimal(0))
  const income  = allPositions.reduce((s, p) => s.plus(D(p.total_income_received_usd)), new Decimal(0))
  const pnlUnr  = allPositions.reduce((s, p) => s.plus(D(p.unrealized_pnl_usd)), new Decimal(0))

  // Global earn totals
  const { totalDailyUSD, totalAccruedUSD } = useMemo(() => {
    return allEarnPositions.reduce(
      (acc, ep) => {
        const daily   = new Decimal(ep.principal_amount).mul(ep.apy_pct).div(100).div(365)
        const accrued = daily.mul(daysAccruedEarn(ep.start_date))
        return {
          totalDailyUSD:   acc.totalDailyUSD.plus(daily),
          totalAccruedUSD: acc.totalAccruedUSD.plus(accrued),
        }
      },
      { totalDailyUSD: new Decimal(0), totalAccruedUSD: new Decimal(0) },
    )
  }, [allEarnPositions])

  function handleExport() {
    const rows = allPositions.map(p => ({
      Portfolio:   p.portfolio_name ?? '',
      Token:       p.ticker ?? '',
      Tipo:        p.asset_type ?? '',
      Red:         p.blockchain_network ?? '',
      Cantidad:    p.quantity_held ?? '',
      Precio_USD:  p.current_price ?? '',
      Mkt_Val_USD: p.market_value_usd ?? '',
      Mkt_Val_ARS: p.market_value_ars ?? '',
      PnL_USD:     p.unrealized_pnl_usd ?? '',
      Income_USD:  p.total_income_received_usd ?? '',
    }))
    downloadCSV(`crypto-${today}.csv`, rows)
  }

  return (
    <div className="space-y-5">
      {/* Global metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="AUM Crypto USD"      value={formatUSD(aumUsd)} sub={formatARS(aumArs)} />
        <MetricCard label="Yield / Income USD"  value={formatUSD(income)} sub="acumulado registrado" />
        <MetricCard
          label="P&L No Realizado USD"
          value={formatUSD(pnlUnr)}
          positive={pnlUnr.gte(0) ? true : false}
          sub={pnlUnr.gte(0) ? '▲ positivo' : '▼ negativo'}
        />
        {allEarnPositions.length > 0 && (
          <MetricCard
            label="Earn diario proyectado"
            value={`${formatUSD(totalDailyUSD)} / día`}
            sub={`${formatUSD(totalAccruedUSD)} acumulado`}
            positive={null}
          />
        )}
      </div>

      {/* CSV export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-slate-400">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* Per-portfolio sections */}
      {portfolioGroups.map(group => (
        <PortfolioSection key={group.portfolio.id} group={group} />
      ))}

      {/* Global earn totals footer */}
      {allEarnPositions.length > 0 && (
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-5 py-4">
          <p className="text-xs font-semibold text-emerald-400/70 uppercase tracking-wider mb-3">
            Total Earn — todos los portfolios
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Capital total</p>
              <p className="text-base font-semibold tabular-nums text-slate-200">
                {formatUSD(new Decimal(
                  allEarnPositions.reduce((s, ep) => s + (ep.principal_amount_usd ?? ep.principal_amount), 0),
                ))}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Diario proyectado</p>
              <p className="text-base font-semibold tabular-nums text-emerald-300">
                {formatUSD(totalDailyUSD)} / día
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Acumulado proyectado</p>
              <p className="text-base font-semibold tabular-nums text-slate-100">
                {formatUSD(totalAccruedUSD)}
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-right">
        {allPositions.length} posiciones · {portfolioGroups.length} plataformas · {today}
      </p>
    </div>
  )
}
