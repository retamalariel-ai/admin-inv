'use client'

import Decimal from 'decimal.js'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatUSD } from '@/lib/utils/calculations'
import type { Database } from '@/types/database.types'

type Position  = Database['public']['Views']['portfolio_valuation_unified']['Row']

const D = (v: number | null) => new Decimal(v ?? 0)

function daysHeld(firstPurchase: string | null, today: string): number {
  if (!firstPurchase) return 0
  const d1 = new Date(firstPurchase).getTime()
  const d2 = new Date(today).getTime()
  return Math.max(1, Math.floor((d2 - d1) / 86_400_000))
}

function calcAPY(position: Position, today: string): string {
  const income  = D(position.total_income_received_usd)
  const cost    = D(position.total_cost_basis_usd)
  const days    = daysHeld(position.first_purchase_date, today)
  if (cost.isZero() || days === 0) return '—'
  const apy = income.div(cost).mul(new Decimal(365 / days)).mul(100)
  return `${apy.toFixed(2)}%`
}

interface Props {
  positions: Position[]
  today:     string
}

export default function EarnTracker({ positions, today }: Props) {
  const earnTypes = ['CRYPTO_EARN', 'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING']
  const earnPositions = positions.filter(p => earnTypes.includes(p.asset_type ?? ''))

  if (!earnPositions.length) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm">
        Sin posiciones Earn/DeFi activas
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-700 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700 hover:bg-transparent">
            <TableHead>Token</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Red</TableHead>
            <TableHead className="text-right">Capital USD</TableHead>
            <TableHead className="text-right">Income USD</TableHead>
            <TableHead className="text-right">APY estimado</TableHead>
            <TableHead className="text-right">Días</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {earnPositions.map((p, i) => {
            const days    = daysHeld(p.first_purchase_date, today)
            const income  = D(p.total_income_received_usd)
            const cost    = D(p.total_cost_basis_usd)
            const apy     = calcAPY(p, today)
            const platform = p.custodian_name ?? '—'

            return (
              <TableRow key={`earn-${p.asset_id}-${i}`} className="border-slate-700 hover:bg-slate-800/50">
                <TableCell className="font-mono font-semibold text-slate-100">
                  {p.ticker ?? '—'}
                </TableCell>
                <TableCell className="text-slate-300 text-sm">{platform}</TableCell>
                <TableCell className="text-slate-400 text-xs">{p.blockchain_network ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums text-slate-300">
                  {formatUSD(cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-400">
                  {formatUSD(income)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-400 font-medium">
                  {apy}
                </TableCell>
                <TableCell className="text-right tabular-nums text-slate-400">
                  {days}d
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
