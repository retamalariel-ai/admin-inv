'use client'

import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { useFXRates } from '@/hooks/useFXRates'

function fmt(val: import('decimal.js').default | null): string {
  if (!val || val.isZero()) return '—'
  return val.toNumber().toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function FXRatesBar() {
  const { data, isLoading, isError, refetch } = useFXRates()
  const queryClient = useQueryClient()

  async function handleRefresh() {
    try {
      const res  = await fetch('/api/fx-rates/update', { method: 'POST' })
      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Error')
      await queryClient.invalidateQueries({ queryKey: ['fx-rates'] })
      toast.success('Tipos de cambio actualizados')
    } catch (err) {
      toast.error(`Error al actualizar: ${String(err)}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-5">
        <Skeleton className="h-3.5 w-20 bg-muted" />
        <Skeleton className="h-3.5 w-20 bg-muted" />
      </div>
    )
  }

  const mep  = isError ? '—' : fmt(data?.mep  ?? null)
  const ccl  = isError ? '—' : fmt(data?.ccl  ?? null)
  const blue = data?.blue ? fmt(data.blue) : null

  return (
    <div className="flex items-center gap-5">
      {/* Cada par label / valor */}
      {[
        { label: 'MEP',  value: mep  },
        { label: 'CCL',  value: ccl  },
        ...(blue ? [{ label: 'Blue', value: blue }] : []),
      ].map(({ label, value }, i) => (
        <span key={label} className="flex items-center gap-1.5 text-xs">
          {i > 0 && (
            <span className="w-px h-3 bg-border mr-1.5" />
          )}
          <span className="text-muted-foreground/70 uppercase tracking-wider font-medium text-[10px]">
            {label}
          </span>
          <span className="font-financial font-medium text-foreground/90 tabular-nums">
            $ {value}
          </span>
        </span>
      ))}

      {/* Botón refresh */}
      <button
        onClick={handleRefresh}
        title="Actualizar tipos de cambio"
        className="
          ml-1 p-1.5 rounded-md
          text-muted-foreground/50
          hover:text-primary hover:bg-primary/10
          transition-colors duration-150
        "
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  )
}
