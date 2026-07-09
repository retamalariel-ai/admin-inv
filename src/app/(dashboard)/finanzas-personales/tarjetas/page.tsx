import { CreditCard } from 'lucide-react'

export default function TarjetasPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Tarjetas y Cuotas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gestión de tarjetas de crédito y cuotas pendientes</p>
      </div>

      <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
        <CreditCard className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">Próximamente</p>
        <p className="text-sm text-muted-foreground/60">Administración de tarjetas, cuotas y fechas de cierre</p>
      </div>
    </div>
  )
}
