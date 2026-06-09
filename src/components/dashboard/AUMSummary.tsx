'use client'

import Decimal from 'decimal.js'
import { formatARS, formatUSD } from '@/lib/utils/calculations'

interface AUMSummaryProps {
  totalAUMars:    number
  totalAUMusd:    number
  totalPnlARS:    number
  totalPnlUSD:    number
  clientCount:    number
  portfolioCount: number
}

type AccentColor = 'emerald' | 'blue' | 'amber' | 'none'

interface KpiCardProps {
  label:    string
  value:    string
  valueSub?: string
  valueSubPositive?: boolean | null
  sub?:     string
  accent?:  AccentColor
  colSpan?: 'col-span-1' | 'col-span-2'
  valuePositive?: boolean | null
}

const ACCENT_BORDER: Record<AccentColor, string> = {
  emerald: 'border-l-primary',
  blue:    'border-l-[oklch(0.68_0.120_224)]',
  amber:   'border-l-amber-500',
  none:    'border-l-transparent',
}

function KpiCard({
  label, value, valueSub, valueSubPositive, sub,
  accent = 'none', colSpan = 'col-span-1', valuePositive,
}: KpiCardProps) {
  const valueColor =
    valuePositive === null || valuePositive === undefined
      ? 'text-foreground'
      : valuePositive ? 'text-emerald-400' : 'text-red-400'

  const subColor =
    valueSubPositive === null || valueSubPositive === undefined
      ? 'text-muted-foreground'
      : valueSubPositive ? 'text-emerald-500' : 'text-red-400'

  return (
    <div
      className={`
        ${colSpan}
        rounded-lg bg-card
        border border-border border-l-2 ${ACCENT_BORDER[accent]}
        px-6 py-5
        hover:bg-accent/30 transition-colors duration-200
      `}
    >
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-3">
        {label}
      </p>
      <p className={`font-financial text-[26px] font-semibold leading-none tracking-tight ${valueColor}`}>
        {value}
      </p>
      {valueSub && (
        <p className={`mt-1 text-base font-semibold tabular-nums ${subColor}`}>
          {valueSub}
        </p>
      )}
      {sub && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/60">
          {sub}
        </p>
      )}
    </div>
  )
}

export default function AUMSummary({
  totalAUMars,
  totalAUMusd,
  totalPnlARS,
  totalPnlUSD,
  clientCount,
  portfolioCount,
}: AUMSummaryProps) {
  const pnlARS = new Decimal(totalPnlARS)
  const pnlUSD = new Decimal(totalPnlUSD)
  const hasDivergence = pnlARS.gt(0) && pnlUSD.lt(0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-4">
        {/* AUM: ARS + USD en una sola card */}
        <KpiCard
          label="AUM Total"
          value={formatARS(new Decimal(totalAUMars))}
          valueSub={formatUSD(new Decimal(totalAUMusd)) + ' MEP'}
          valueSubPositive={null}
          accent="emerald"
          colSpan="col-span-2"
        />

        {/* P&L no realizado: ARS + USD con sus propios colores */}
        <KpiCard
          label="P&L No Realizado"
          value={formatARS(pnlARS)}
          valueSub={formatUSD(pnlUSD)}
          valuePositive={pnlARS.gte(0)}
          valueSubPositive={pnlUSD.gte(0)}
          accent={hasDivergence ? 'amber' : pnlARS.gte(0) ? 'emerald' : 'none'}
          colSpan="col-span-2"
        />

        <KpiCard
          label="Clientes activos"
          value={String(clientCount)}
          colSpan="col-span-2"
        />
        <KpiCard
          label="Portfolios activos"
          value={String(portfolioCount)}
          colSpan="col-span-2"
        />
      </div>

      {/* Aviso de divergencia ARS vs USD */}
      {hasDivergence && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 px-5 py-3 text-sm text-slate-300">
          <span className="text-amber-400 font-semibold">⚠ Efecto devaluación:&nbsp;</span>
          La cartera muestra ganancia en ARS (
          <span className="font-mono text-emerald-400">{formatARS(pnlARS)}</span>) pero
          pérdida en USD (
          <span className="font-mono text-red-400">{formatUSD(pnlUSD)}</span>).
          Parte de la ganancia en pesos se debe a la devaluación del peso.
        </div>
      )}
    </div>
  )
}
