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
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Operaciones Cerradas ({positions.length})
      </button>

      {open && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Ticker</TableHead>
                <TableHead className="text-muted-foreground">Nombre</TableHead>
                <TableHead className="text-muted-foreground">F. Compra</TableHead>
                <TableHead className="text-muted-foreground">F. Cierre</TableHead>
                <TableHead className="text-muted-foreground text-right">Costo Total</TableHead>
                <TableHead className="text-muted-foreground text-right">P&amp;L ARS</TableHead>
                <TableHead className="text-muted-foreground text-right">P&amp;L %</TableHead>
                <TableHead className="text-muted-foreground text-right">P&amp;L USD</TableHead>
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
                    <TableRow key={i} className="border-border/50 hover:bg-accent/10">
                      <TableCell className="font-mono font-semibold text-foreground">
                        {(Array.isArray(p.assets) ? p.assets[0]?.ticker : p.assets?.ticker) ?? '—'}
                      </TableCell>
                      <TableCell className="text-foreground/80 text-sm">
                        {(Array.isArray(p.assets) ? p.assets[0]?.name : p.assets?.name) ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {p.first_purchase_date ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm tabular-nums">
                        {p.last_transaction_date ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-foreground/80 font-mono text-sm tabular-nums">
                        {costARS.gt(0) ? formatARS(costARS) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold text-sm tabular-nums ${pos ? 'text-success' : 'text-destructive'}`}>
                        {formatARS(pnlARS)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm tabular-nums ${pos ? 'text-success' : 'text-destructive'}`}>
                        {pnlPct ? formatPct(pnlPct) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm tabular-nums ${pnlUSD.gte(0) ? 'text-success' : 'text-destructive'}`}>
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
