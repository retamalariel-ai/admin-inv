'use client'

export interface PFSubscription {
  id: string
  name: string
  amount: number
  currency: string
  frequency: string | null
  next_due_date: string | null
  personal_categories: { name: string; icon: string | null } | null
}

interface Props {
  subscriptions: PFSubscription[]
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(dateStr + 'T00:00:00')
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

function DaysBadge({ days }: { days: number }) {
  const color =
    days < 0  ? 'bg-red-900/60 text-red-300' :
    days === 0 ? 'bg-red-900/60 text-red-300' :
    days <= 7  ? 'bg-amber-900/60 text-amber-300' :
                 'bg-slate-700/60 text-slate-300'

  const label = days < 0 ? 'Vencido' : days === 0 ? 'Hoy' : `${days}d`

  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {label}
    </span>
  )
}

export default function VencimientosCard({ subscriptions }: Props) {
  const sorted = [...subscriptions]
    .filter(s => s.next_due_date != null)
    .sort((a, b) => a.next_due_date!.localeCompare(b.next_due_date!))

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg bg-card border border-border p-5">
        <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-4">
          Vencimientos
        </p>
        <p className="text-sm text-muted-foreground/60">Sin vencimientos próximos</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-4">
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
        Vencimientos · próx. 30 días
      </p>

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {sorted.map(sub => {
          const days = daysUntil(sub.next_due_date!)
          return (
            <div key={sub.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {sub.personal_categories?.icon && (
                  <span className="text-sm shrink-0">{sub.personal_categories.icon}</span>
                )}
                <p className="text-xs text-foreground truncate">{sub.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {sub.currency === 'ARS'
                    ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(sub.amount)
                    : sub.amount.toFixed(2) + ' ' + sub.currency}
                </p>
                <DaysBadge days={days} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
