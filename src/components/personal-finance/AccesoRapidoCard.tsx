'use client'

import { useRouter } from 'next/navigation'
import { Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AccesoRapidoCard() {
  const router = useRouter()

  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-4">
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
        Acceso rápido
      </p>

      <div className="space-y-2">
        <Button
          className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => router.push('/finanzas-personales/transacciones?new=1')}
        >
          <Plus className="h-4 w-4" />
          Nueva transacción
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => router.push('/finanzas-personales/tarjetas?new=1')}
        >
          <CreditCard className="h-4 w-4" />
          Nueva cuota
        </Button>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5">
        <button
          onClick={() => router.push('/finanzas-personales/transacciones')}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          → Ver transacciones
        </button>
        <button
          onClick={() => router.push('/finanzas-personales/tarjetas')}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          → Ver tarjetas y cuotas
        </button>
        <button
          onClick={() => router.push('/finanzas-personales/presupuesto')}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          → Ver presupuesto
        </button>
      </div>
    </div>
  )
}
