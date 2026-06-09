'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']

const RISK_BADGE: Record<string, string> = {
  CONSERVADOR: 'bg-slate-700 text-slate-300',
  MODERADO:    'bg-blue-900/60 text-blue-300',
  AGRESIVO:    'bg-amber-900/60 text-amber-300',
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function ClientHeader({ client }: { client: Client }) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-emerald-500/20 border border-emerald-500/40
                        flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-emerald-400">{initials(client.full_name)}</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{client.full_name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
            {client.cuit && <span className="font-mono">{client.cuit}</span>}
            {client.email && <span>{client.email}</span>}
            <Badge
              className={`text-xs border-0 ${RISK_BADGE[client.risk_profile ?? ''] ?? 'bg-slate-700 text-slate-400'}`}
            >
              {client.risk_profile ?? '—'}
            </Badge>
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      >
        <Pencil className="h-3.5 w-3.5 mr-1.5" />
        Editar
      </Button>
    </div>
  )
}
