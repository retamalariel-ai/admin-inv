'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NewClientDialog from './NewClientDialog'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsListProps {
  clients: Client[]
}

/* Color del avatar + badge según perfil de riesgo */
const RISK_STYLES: Record<string, { avatar: string; badge: string }> = {
  CONSERVADOR: {
    avatar: 'bg-primary/10 text-primary ring-primary/20',
    badge:  'bg-muted text-muted-foreground ring-border',
  },
  MODERADO: {
    avatar: 'bg-[oklch(0.68_0.120_224/12%)] text-[oklch(0.73_0.100_224)] ring-[oklch(0.68_0.120_224/22%)]',
    badge:  'bg-[oklch(0.68_0.120_224/10%)] text-[oklch(0.73_0.100_224)] ring-[oklch(0.68_0.120_224/20%)]',
  },
  AGRESIVO: {
    avatar: 'bg-[oklch(0.65_0.180_25/12%)] text-[oklch(0.72_0.150_25)] ring-[oklch(0.65_0.180_25/22%)]',
    badge:  'bg-[oklch(0.65_0.180_25/10%)] text-[oklch(0.72_0.150_25)] ring-[oklch(0.65_0.180_25/20%)]',
  },
}

const DEFAULT_STYLE = RISK_STYLES.CONSERVADOR

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default function ClientsList({ clients }: ClientsListProps) {
  const router     = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <div className="flex justify-end">
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          No hay clientes. Agregá el primero.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(client => {
            const style = RISK_STYLES[client.risk_profile ?? ''] ?? DEFAULT_STYLE
            return (
              <article
                key={client.id}
                className="
                  group rounded-xl bg-card
                  border border-border
                  p-5 flex flex-col gap-4
                  hover:border-primary/25 hover:bg-accent/30
                  transition-all duration-200
                "
              >
                {/* Header: avatar + nombre + badge */}
                <div className="flex items-start gap-3">
                  <div className={`
                    h-10 w-10 rounded-full shrink-0
                    flex items-center justify-center
                    text-sm font-semibold
                    ring-1
                    ${style.avatar}
                  `}>
                    {initials(client.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground/90 truncate">
                      {client.full_name}
                    </p>
                    {client.cuit && (
                      <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5">
                        {client.cuit}
                      </p>
                    )}
                  </div>

                  {/* Badge perfil de riesgo */}
                  {client.risk_profile && (
                    <span className={`
                      flex-shrink-0 px-2 py-0.5 rounded-md
                      text-[10px] font-semibold uppercase tracking-wider
                      ring-1
                      ${style.badge}
                    `}>
                      {client.risk_profile}
                    </span>
                  )}
                </div>

                {/* Email */}
                {client.email && (
                  <p className="text-[12px] text-muted-foreground/70 truncate -mt-1">
                    {client.email}
                  </p>
                )}

                {/* Footer: fecha + link */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                    desde {formatDate(client.onboarding_date)}
                  </span>
                  <button
                    onClick={() => router.push(`/clientes/${client.id}`)}
                    className="
                      flex items-center gap-1 text-xs font-medium
                      text-primary/70
                      group-hover:text-primary
                      transition-colors duration-150
                    "
                  >
                    Ver Portfolio
                    <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <NewClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
