'use client'

import Decimal from 'decimal.js'

export interface PFInstallment {
  id: string
  description: string
  installment_amount: number
  currency: string
  total_installments: number
  paid_installments: number
  start_date: string
  card_id: string | null
  personal_cards: { name: string } | null
}

interface Props {
  installments: PFInstallment[]
}

export default function CuotasCard({ installments }: Props) {
  const active = installments.filter(i => i.paid_installments < i.total_installments)

  // Agrupar por tarjeta
  const byCard = active.reduce<Record<string, PFInstallment[]>>((acc, inst) => {
    const key = inst.personal_cards?.name ?? 'Sin tarjeta'
    acc[key] = [...(acc[key] ?? []), inst]
    return acc
  }, {})

  const totalPending = active.reduce(
    (s, i) => s.plus(new Decimal(i.installment_amount).mul(i.total_installments - i.paid_installments)),
    new Decimal(0),
  )

  function fmtARS(n: number) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
  }

  if (active.length === 0) {
    return (
      <div className="rounded-lg bg-card border border-border p-5">
        <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-4">
          Cuotas pendientes
        </p>
        <p className="text-sm text-muted-foreground/60">Sin cuotas activas</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
          Cuotas pendientes
        </p>
        <p className="text-[10px] text-muted-foreground/60">{active.length} activas</p>
      </div>

      <div className="space-y-4 max-h-56 overflow-y-auto">
        {Object.entries(byCard).map(([card, items]) => (
          <div key={card}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              {card}
            </p>
            <div className="space-y-1.5">
              {items.map(inst => {
                const remaining = inst.total_installments - inst.paid_installments
                return (
                  <div key={inst.id} className="flex items-center justify-between gap-2">
                    <p className="text-xs text-foreground truncate flex-1">{inst.description}</p>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold tabular-nums text-amber-400">
                        {fmtARS(inst.installment_amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {inst.paid_installments}/{inst.total_installments}
                        {' · '}{remaining} restante{remaining !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-[10px] text-muted-foreground mb-0.5">Total deuda pendiente</p>
        <p className="text-sm font-semibold tabular-nums text-amber-400">
          {fmtARS(totalPending.toNumber())}
        </p>
      </div>
    </div>
  )
}
