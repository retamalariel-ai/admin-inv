import { BarChart3 } from 'lucide-react'

export default function PatrimonioPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Patrimonio Neto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Activos, pasivos y evolución del patrimonio personal</p>
      </div>

      <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
        <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">Próximamente</p>
        <p className="text-sm text-muted-foreground/60">Consolidado de activos financieros, efectivo y pasivos</p>
      </div>
    </div>
  )
}
