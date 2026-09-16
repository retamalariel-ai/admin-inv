'use client'

import Decimal from 'decimal.js'
import { formatARS, formatUSD } from '@/lib/utils/calculations'
import type { EarnPosition } from '@/components/crypto/EarnTracker'

interface PersonalAccount {
  id: string
  name: string
  type: string
  currency: string
  current_balance: number | null
  computed_balance: number
}

interface ClientMetricsProps {
  positions: {
    market_value_ars:          number | null
    market_value_usd:          number | null
    unrealized_pnl_ars:        number | null
    unrealized_pnl_usd:        number | null
    realized_gain_loss_ars:    number | null
    total_income_received_ars: number | null
    total_return_ars:          number | null
    total_return_usd:          number | null
  }[]
  earnPositions: EarnPosition[]
  personalAccounts: PersonalAccount[]
  fxMep: number | null
}

function sum(arr: (number | null)[]): Decimal {
  return arr.reduce((s, v) => s.plus(new Decimal(v ?? 0)), new Decimal(0))
}

function MetricCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  const color =
    positive === null || positive === undefined
      ? 'text-foreground'
      : positive
        ? 'text-[#00d084]'
        : 'text-[#ff4757]'

  return (
    <div className="rounded bg-card border border-border px-4 py-3">
      <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      <p className={`num text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ClientMetrics({ positions, earnPositions, personalAccounts, fxMep }: ClientMetricsProps) {
  // earn assets (USDT-EARN, SOL-STAKE, etc.) now valued in portfolio_valuation_unified
  // via underlying_asset_id — no separate earnPositions addition needed
  const spotEarnARS = sum(positions.map(p => p.market_value_ars))
  const spotEarnUSD = sum(positions.map(p => p.market_value_usd))

  const pnlARS      = sum(positions.map(p => p.unrealized_pnl_ars))
  const totalRetARS = sum(positions.map(p => p.total_return_ars))

  // earn USD para el breakdown (ya incluido en spotEarnUSD via portfolio_valuation_unified)
  const earnUSD = earnPositions.reduce((s, ep) => s + (ep.principal_amount_usd ?? 0), 0)
  const spotUSD = spotEarnUSD.minus(earnUSD).toNumber()

  const personalUSD = personalAccounts.reduce((s, acc) => {
    const bal = acc.computed_balance
    if (bal <= 0) return s
    if (acc.currency === 'USD') return s + bal
    if (acc.currency === 'USDT') return s + bal
    if (acc.currency === 'ARS' && fxMep) return s + bal / fxMep
    return s
  }, 0)

  const personalARS = personalAccounts.reduce((s, acc) => {
    const bal = acc.computed_balance
    if (bal <= 0) return s
    if (acc.currency === 'ARS') return s + bal
    if (acc.currency === 'USD' && fxMep) return s + bal * fxMep
    if (acc.currency === 'USDT' && fxMep) return s + bal * fxMep
    return s
  }, 0)

  const grandTotalARS = spotEarnARS.plus(personalARS)
  const grandTotalUSD = spotEarnUSD.plus(personalUSD)

  const aumSubUSD = `spot ${formatUSD(new Decimal(spotUSD))} · earn ${formatUSD(new Decimal(earnUSD))} · personal ${formatUSD(new Decimal(personalUSD))}`
  const aumSubARS = `spot+earn ${formatARS(spotEarnARS)} · personal ${formatARS(new Decimal(personalARS))}`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="AUM Total ARS"
        value={formatARS(grandTotalARS)}
        sub={aumSubARS}
      />
      <MetricCard
        label="AUM Total USD"
        value={formatUSD(grandTotalUSD)}
        sub={aumSubUSD}
      />
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
