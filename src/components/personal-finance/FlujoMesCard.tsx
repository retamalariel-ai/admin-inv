'use client'

import Decimal from 'decimal.js'

export interface PFTransaction {
  id: string
  type: string
  amount: number
  currency: string
  amount_ars: number | null
  description: string | null
  date: string
}

interface Props {
  transactions: PFTransaction[]
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function FlujoMesCard({ transactions }: Props) {
  const ingresos = transactions
    .filter(t => t.type === 'INGRESO')
    .reduce((s, t) => s.plus(t.amount_ars ?? t.amount), new Decimal(0))

  const egresos = transactions
    .filter(t => t.type === 'EGRESO')
    .reduce((s, t) => s.plus(t.amount_ars ?? t.amount), new Decimal(0))

  const balance  = ingresos.minus(egresos)
  const positive = balance.gte(0)
  const total    = ingresos.plus(egresos)
  const ingPct   = total.gt(0) ? ingresos.div(total).mul(100).toNumber() : 50

  const now   = new Date()
  const month = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' })

  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
          Flujo del mes
        </p>
        <p className="text-[10px] text-muted-foreground/60 capitalize">{month}</p>
      </div>

      {/* Balance neto */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-0.5">Balance neto</p>
        <p className={`text-xl font-semibold tabular-nums ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
          {positive ? '+' : ''}{fmtARS(balance.toNumber())}
        </p>
      </div>

      {/* Barra de progreso */}
      <div>
        <div className="flex h-2 rounded-full overflow-hidden bg-muted/40">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${ingPct}%` }}
          />
          <div className="bg-red-500 flex-1" />
        </div>
        <div className="flex justify-between mt-2">
          <div>
            <p className="text-[10px] text-muted-foreground">Ingresos</p>
            <p className="text-sm font-semibold text-emerald-400 tabular-nums">{fmtARS(ingresos.toNumber())}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Egresos</p>
            <p className="text-sm font-semibold text-red-400 tabular-nums">{fmtARS(egresos.toNumber())}</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/50">
        {transactions.length} transacciones este mes
      </p>
    </div>
  )
}
