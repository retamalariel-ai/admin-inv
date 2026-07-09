import { ArrowLeftRight } from 'lucide-react'

export default function TransaccionesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Transacciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ingresos, egresos y transferencias personales</p>
      </div>

      <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
        <ArrowLeftRight className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-base font-medium text-muted-foreground">Próximamente</p>
        <p className="text-sm text-muted-foreground/60">Listado y carga de transacciones personales</p>
      </div>
    </div>
  )
}
