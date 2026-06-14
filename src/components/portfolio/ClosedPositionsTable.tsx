'use client'

import { useState } from 'react'
import Decimal from 'decimal.js'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatARS, formatUSD, formatPct } from '@/lib/utils/calculations'

export interface ClosedPosition {
  realized_gain_loss_ars: number | null
  realized_gain_loss_usd: number | null
  total_cost_basis_ars:   number | null
  first_purchase_date:    string | null
  last_transaction_date:  string | null
  assets: { ticker: string; name: string; asset_type: string }[] | { ticker: string; name: string; asset_type: string } | null
}

export default function ClosedPositionsTable({ positions }: { positions: ClosedPosition[] }) {
  const [open, setOpen] = useState(false)

  if (positions.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 hover:text-white transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Operaciones Cerradas ({positions.length})
      </button>

      {open && (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Ticker</TableHead>
                <TableHead className="text-slate-400">Nombre</TableHead>
                <TableHead className="text-slate-400">F. Compra</TableHead>
                <TableHead className="text-slate-400">F. Cierre</TableHead>
                <TableHead className="text-slate-400 text-right">Costo Total</TableHead>
                <TableHead className="text-slate-400 text-right">P&amp;L ARS</TableHead>
                <TableHead className="text-slate-400 text-right">P&amp;L %</TableHead>
                <TableHead className="text-slate-400 text-right">P&amp;L USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions
                .slice()
                .sort((a, b) =>
                  (b.last_transaction_date ?? '').localeCompare(a.last_transaction_date ?? ''),
                )
                .map((p, i) => {
                  const pnlARS  = new Decimal(p.realized_gain_loss_ars ?? 0)
                  const pnlUSD  = new Decimal(p.realized_gain_loss_usd ?? 0)
                  const costARS = new Decimal(p.total_cost_basis_ars ?? 0)
                  const pnlPct  = costARS.gt(0) ? pnlARS.div(costARS) : null
                  const pos     = pnlARS.gte(0)

                  return (
                    <TableRow key={i} className="border-slate-700">
                      <TableCell className="font-mono font-semibold text-white">
                        {(Array.isArray(p.assets) ? p.assets[0]?.ticker : p.assets?.ticker) ?? '—'}
                      </TableCell>
                      <TableCell className="text-slate-300 text-sm">
                        {(Array.isArray(p.assets) ? p.assets[0]?.name : p.assets?.name) ?? '—'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm tabular-nums">
                        {p.first_purchase_date ?? '—'}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm tabular-nums">
                        {p.last_transaction_date ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-slate-300 font-mono text-sm tabular-nums">
                        {costARS.gt(0) ? formatARS(costARS) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold text-sm tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatARS(pnlARS)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm tabular-nums ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                        {pnlPct ? formatPct(pnlPct) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm tabular-nums ${pnlUSD.gte(0) ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatUSD(pnlUSD)}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
