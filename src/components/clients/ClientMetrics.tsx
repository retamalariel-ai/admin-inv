'use client'

import Decimal from 'decimal.js'
import { formatARS, formatUSD } from '@/lib/utils/calculations'

interface ClientMetricsProps {
  positions: {
    market_value_ars:       number | null
    market_value_usd:       number | null
    unrealized_pnl_ars:     number | null
    unrealized_pnl_usd:     number | null
    realized_gain_loss_ars: number | null
    total_income_received_ars: number | null
    total_return_ars:       number | null
    total_return_usd:       number | null
  }[]
}

function sum(arr: (number | null)[]): Decimal {
  return arr.reduce((s, v) => s.plus(new Decimal(v ?? 0)), new Decimal(0))
}

function MetricCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color =
    positive === null || positive === undefined
      ? 'text-white'
      : positive
        ? 'text-emerald-400'
        : 'text-red-400'

  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function ClientMetrics({ positions }: ClientMetricsProps) {
  const totalARS     = sum(positions.map(p => p.market_value_ars))
  const totalUSD     = sum(positions.map(p => p.market_value_usd))
  const pnlARS       = sum(positions.map(p => p.unrealized_pnl_ars))
  const totalRetARS  = sum(positions.map(p => p.total_return_ars))

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="AUM Total ARS" value={formatARS(totalARS)} sub="valuación a mercado" />
      <MetricCard label="AUM Total USD" value={formatUSD(totalUSD)} sub="dólares MEP" />
      <MetricCard
        label="P&L No Realizado ARS"
        value={formatARS(pnlARS)}
        positive={pnlARS.gte(0)}
      />
      <MetricCard
        label="Retorno Total ARS"
        value={formatARS(totalRetARS)}
        sub="realizado + income"
        positive={totalRetARS.gte(0)}
      />
    </div>
  )
}
