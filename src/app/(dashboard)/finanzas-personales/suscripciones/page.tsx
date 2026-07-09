import { RefreshCcw } from 'lucide-react'

export default function SuscripcionesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Suscripciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Servicios recurrentes y vencimientos</p>
      </div>

      <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCcw className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">Próximamente</p>
        <p className="text-sm text-muted-foreground/60">Netflix, Spotify, servicios y otros gastos recurrentes</p>
      </div>
    </div>
  )
}
