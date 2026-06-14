'use client'

import Decimal from 'decimal.js'
import { formatARS, formatUSD, formatPct } from '@/lib/utils/calculations'

interface PortfolioSummaryProps {
  positions: {
    market_value_ars:        number | null
    market_value_usd:        number | null
    unrealized_pnl_ars:      number | null
    unrealized_pnl_usd:      number | null
    fx_gain_loss_ars:        number | null
    spread_vs_breakeven_pct: number | null
    daily_pnl_ars?:          number | null
  }[]
  allPositions: {
    realized_gain_loss_ars:    number | null
    realized_gain_loss_usd:    number | null
    total_income_received_ars: number | null
    total_income_received_usd: number | null
  }[]
}

function sum(arr: (number | null)[]): Decimal {
  return arr.reduce((s, v) => s.plus(new Decimal(v ?? 0)), new Decimal(0))
}

function MetricCard({
  label, value, sub, positive, subPositive,
}: {
  label: string
  value: string
  sub?: string
  positive?: boolean | null
  subPositive?: boolean | null
}) {
  const color =
    positive === null || positive === undefined
      ? 'text-white'
      : positive ? 'text-emerald-400' : 'text-red-400'
  const subColor =
    subPositive === null || subPositive === undefined
      ? 'text-slate-400'
      : subPositive ? 'text-emerald-500' : 'text-red-400'
  return (
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && (
        <p className={`text-sm font-semibold tabular-nums mt-0.5 ${subColor}`}>{sub}</p>
      )}
    </div>
  )
}

export default function PortfolioSummary({ positions, allPositions }: PortfolioSummaryProps) {
  const aumARS      = sum(positions.map(p => p.market_value_ars))
  const aumUSD      = sum(positions.map(p => p.market_value_usd))
  const pnlARS      = sum(positions.map(p => p.unrealized_pnl_ars))
  const pnlUSD      = sum(positions.map(p => p.unrealized_pnl_usd))
  const fxGain      = sum(positions.map(p => p.fx_gain_loss_ars))
  // Realized + income desde TODAS las posiciones (incluye cerradas)
  const realizedARS = sum(allPositions.map(p => p.realized_gain_loss_ars))
  const realizedUSD = sum(allPositions.map(p => p.realized_gain_loss_usd))
  const incomeARS   = sum(allPositions.map(p => p.total_income_received_ars))
  const totalRetARS = pnlARS.plus(realizedARS).plus(incomeARS)

  const dailyPnlARS    = sum(positions.map(p => p.daily_pnl_ars ?? null))
  const hasDailyData   = positions.some(p => p.daily_pnl_ars != null)
  const dailyPct       = aumARS.gt(0) && hasDailyData
    ? dailyPnlARS.div(aumARS.minus(dailyPnlARS))
    : null

  const withBreakEven  = positions.filter(p => p.spread_vs_breakeven_pct != null)
  const belowBreakEven = withBreakEven.filter(p => (p.spread_vs_breakeven_pct ?? 0) < 0).length
  const aboveBreakEven = withBreakEven.length - belowBreakEven
  const allAbove       = belowBreakEven === 0 && withBreakEven.length > 0

  // Divergencia: gana en ARS pero pierde en USD (efecto devaluación)
  const hasDivergence = pnlARS.gt(0) && pnlUSD.lt(0)

  return (
    <div className="space-y-4">
      {/* Card de advertencia cuando hay divergencia ARS vs USD */}
      {hasDivergence && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5">
          <p className="text-amber-400 text-sm font-semibold mb-2">
            ⚠ Atención — Efecto devaluación
          </p>
          <p className="text-sm text-slate-300">
            La cartera muestra ganancia en ARS (
            <span className="text-emerald-400 font-mono">{formatARS(pnlARS)}</span>) pero
            pérdida en USD (
            <span className="text-red-400 font-mono">{formatUSD(pnlUSD)}</span>).
          </p>
          <p className="mt-2 text-sm text-slate-400">
            <span className="font-mono text-amber-300">{formatARS(fxGain)}</span> de la ganancia
            en pesos se debe a la devaluación del peso, no a la suba de los activos.
          </p>
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* AUM: muestra siempre ARS + USD */}
        <MetricCard
          label="AUM Total"
          value={formatARS(aumARS)}
          sub={formatUSD(aumUSD) + ' MEP'}
          subPositive={null}
        />

        {/* Variación del día (1D) — comparable con el broker */}
        {hasDailyData && (
          <MetricCard
            label="Hoy (1D)"
            value={formatARS(dailyPnlARS)}
            sub={dailyPct ? formatPct(dailyPct) + ' del portfolio' : 'vs. cierre anterior'}
            positive={dailyPnlARS.gte(0)}
            subPositive={null}
          />
        )}

        {/* P&L no realizado: ARS como valor principal, USD como subtítulo con su propio color */}
        <MetricCard
          label="P&L No Realizado"
          value={formatARS(pnlARS)}
          sub={formatUSD(pnlUSD)}
          positive={pnlARS.gte(0)}
          subPositive={pnlUSD.gte(0)}
        />

        <MetricCard
          label="P&L Realizado"
          value={formatARS(realizedARS)}
          sub={formatUSD(realizedUSD)}
          positive={realizedARS.gte(0)}
          subPositive={realizedUSD.gte(0)}
        />
        <MetricCard
          label="Income ARS"
          value={formatARS(incomeARS)}
          sub="dividendos + renta"
          positive={incomeARS.gte(0)}
        />
        <MetricCard
          label="Retorno Total ARS"
          value={formatARS(totalRetARS)}
          sub="realizado + income"
          positive={totalRetARS.gte(0)}
        />
        {withBreakEven.length > 0 && (
          <MetricCard
            label="Sobre break-even"
            value={allAbove ? `${aboveBreakEven}/${withBreakEven.length}` : `${belowBreakEven} bajo B-E`}
            sub={allAbove ? 'todas las posiciones cubren costos' : `${aboveBreakEven} sobre · ${belowBreakEven} bajo`}
            positive={allAbove ? true : belowBreakEven === 0 ? null : false}
          />
        )}
      </div>
    </div>
  )
}
