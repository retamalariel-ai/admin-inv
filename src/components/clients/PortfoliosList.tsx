'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatARS } from '@/lib/utils/calculations'
import NewPortfolioDialog from './NewPortfolioDialog'
import type { Database } from '@/types/database.types'

type Portfolio = Database['public']['Tables']['portfolios']['Row']
type Position  = Database['public']['Views']['portfolio_valuation_unified']['Row']

interface PortfoliosListProps {
  clientId:   string
  portfolios: Portfolio[]
  positions:  Position[]
}

const CUSTODIAN_BADGE: Record<string, string> = {
  ALYCE:         'bg-blue-900/60 text-blue-300',
  EXCHANGE_CEX:  'bg-amber-900/60 text-amber-300',
  WALLET_HW:     'bg-purple-900/60 text-purple-300',
  WALLET_SW:     'bg-slate-700 text-slate-300',
  DEFI_PROTOCOL: 'bg-emerald-900/60 text-emerald-300',
  EARN_PLATFORM: 'bg-orange-900/60 text-orange-300',
  OTRO:          'bg-slate-700 text-slate-400',
}
const CUSTODIAN_LABEL: Record<string, string> = {
  ALYCE: 'ALyC', EXCHANGE_CEX: 'CEX', WALLET_HW: 'HW',
  WALLET_SW: 'SW', DEFI_PROTOCOL: 'DeFi', EARN_PLATFORM: 'Earn', OTRO: 'Otro',
}

export default function PortfoliosList({ clientId, portfolios, positions }: PortfoliosListProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  // AUM y recuento de posiciones por portfolio
  const statsMap = new Map<string, { aum: Decimal; count: number }>()
  for (const p of positions) {
    if (!p.portfolio_id) continue
    const prev = statsMap.get(p.portfolio_id) ?? { aum: new Decimal(0), count: 0 }
    statsMap.set(p.portfolio_id, {
      aum:   prev.aum.plus(new Decimal(p.market_value_ars ?? 0)),
      count: prev.count + 1,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Portfolios
        </h2>
        <Button
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
          Nuevo Portfolio
        </Button>
      </div>

      {portfolios.length === 0 ? (
        <p className="text-sm text-slate-500 py-4">No hay portfolios aún.</p>
      ) : (
        <div className="space-y-3">
          {portfolios.map(port => {
            const stats = statsMap.get(port.id)
            return (
              <div
                key={port.id}
                className="rounded-xl bg-slate-800 border border-slate-700 p-4
                           flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-white">{port.name}</p>
                    <Badge className={`text-xs border-0 ${CUSTODIAN_BADGE[port.custodian_type] ?? 'bg-slate-700 text-slate-400'}`}>
                      {CUSTODIAN_LABEL[port.custodian_type] ?? port.custodian_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400">
                    {port.custodian_name}
                    {stats
                      ? ` · ${stats.count} posición${stats.count !== 1 ? 'es' : ''}`
                      : ' · Sin posiciones'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-white tabular-nums">
                    {stats ? formatARS(stats.aum) : '—'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/clientes/${clientId}/portfolio/${port.id}`)}
                    className="mt-2 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white text-xs"
                  >
                    Ver Posiciones
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <NewPortfolioDialog clientId={clientId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
