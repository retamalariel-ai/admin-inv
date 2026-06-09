'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import Decimal from 'decimal.js'
import { Ban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatARS } from '@/lib/utils/calculations'

// ── Types ──────────────────────────────────────────────────────────────────
interface TxRow {
  id:                string
  trade_date:        string
  transaction_type:  string
  quantity:          number | null
  price_per_unit:    number | null
  net_amount:        number | null
  currency:          string
  ticker:            string | null
  asset_name:        string | null
  portfolio_name:    string | null
  client_name:       string | null
  is_cancelled:      boolean
}

// ── TX type groups for badge colors ───────────────────────────────────────
const TX_COLOR: Record<string, string> = {
  COMPRA:          'bg-blue-900/60 text-blue-300',
  VENTA:           'bg-red-900/60 text-red-300',
  SUSCRIPCION_FCI: 'bg-blue-800/60 text-blue-300',
  RESCATE_FCI:     'bg-red-800/60 text-red-300',
  RENTA:           'bg-emerald-900/60 text-emerald-300',
  DIVIDENDO:       'bg-emerald-800/60 text-emerald-300',
  AMORTIZACION:    'bg-teal-900/60 text-teal-300',
  INTERES_EARN:    'bg-amber-900/60 text-amber-300',
  REWARD_DEFI:     'bg-amber-800/60 text-amber-300',
  SWAP_CRYPTO:     'bg-purple-900/60 text-purple-300',
  DEPOSITO:        'bg-slate-700 text-slate-300',
  RETIRO:          'bg-slate-700 text-slate-400',
  TRANSFERENCIA_IN:  'bg-slate-700 text-slate-300',
  TRANSFERENCIA_OUT: 'bg-slate-700 text-slate-400',
}

const TX_LABELS: Record<string, string> = {
  COMPRA: 'Compra', VENTA: 'Venta',
  SUSCRIPCION_FCI: 'Susc. FCI', RESCATE_FCI: 'Rescate FCI',
  RENTA: 'Renta', DIVIDENDO: 'Dividendo', AMORTIZACION: 'Amort.',
  INTERES_EARN: 'Earn', REWARD_DEFI: 'Reward', SWAP_CRYPTO: 'Swap',
  DEPOSITO: 'Depósito', RETIRO: 'Retiro',
  TRANSFERENCIA_IN: 'Transf. In', TRANSFERENCIA_OUT: 'Transf. Out',
}

interface TransactionsListProps {
  rows: TxRow[]
}

export default function TransactionsList({ rows }: TransactionsListProps) {
  const [cancelTarget, setCancelTarget] = useState<TxRow | null>(null)
  const [reason, setReason]             = useState('')
  const [cancelling, setCancelling]     = useState(false)
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set())

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('transactions')
      .update({
        is_cancelled:        true,
        cancelled_at:        new Date().toISOString(),
        cancellation_reason: reason.trim() || null,
      })
      .eq('id', cancelTarget.id)

    setCancelling(false)

    if (error) {
      toast.error(`Error: ${error.message}`)
      return
    }

    toast.success('Transacción anulada')
    setCancelledIds(prev => new Set([...prev, cancelTarget.id]))
    setCancelTarget(null)
    setReason('')
  }

  return (
    <>
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-800/80">
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Fecha</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Cliente</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Portfolio</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Activo</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Cantidad</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Precio</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider text-right">Monto neto</TableHead>
              <TableHead className="text-slate-400 text-xs uppercase tracking-wider">Moneda</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500 py-12">
                  Sin transacciones
                </TableCell>
              </TableRow>
            ) : (
              rows.map(tx => {
                const isCancelled = tx.is_cancelled || cancelledIds.has(tx.id)
                return (
                  <TableRow
                    key={tx.id}
                    className={`border-slate-700/50 hover:bg-slate-800/60 ${isCancelled ? 'opacity-40' : ''}`}
                  >
                    <TableCell className="text-slate-400 text-sm font-mono whitespace-nowrap">
                      {tx.trade_date}
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">{tx.client_name ?? '—'}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{tx.portfolio_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs border-0 ${TX_COLOR[tx.transaction_type] ?? 'bg-slate-700 text-slate-400'}`}>
                        {TX_LABELS[tx.transaction_type] ?? tx.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold text-emerald-400">
                      {tx.ticker ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-200 tabular-nums">
                      {tx.quantity != null ? new Decimal(tx.quantity).toFixed(4) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-400 text-sm tabular-nums">
                      {tx.price_per_unit != null ? new Decimal(tx.price_per_unit).toFixed(2) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-white tabular-nums">
                      {tx.net_amount != null ? formatARS(new Decimal(tx.net_amount)) : '—'}
                    </TableCell>
                    <TableCell className="text-slate-400 text-sm">{tx.currency}</TableCell>
                    <TableCell>
                      {!isCancelled && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCancelTarget(tx)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs px-2"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Anular
                        </Button>
                      )}
                      {isCancelled && (
                        <span className="text-xs text-slate-600">Anulada</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* AlertDialog de confirmación de anulación */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) { setCancelTarget(null); setReason('') } }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Anular transacción?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta acción marcará la transacción como anulada y no se puede deshacer.
              {cancelTarget && (
                <span className="block mt-1 text-slate-300 font-mono text-xs">
                  {cancelTarget.trade_date} · {cancelTarget.transaction_type} ·{' '}
                  {cancelTarget.ticker}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1">
            <Label className="text-slate-300 text-sm">Motivo de anulación (opcional)</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Error de carga, operación duplicada..."
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-400 hover:text-slate-200 bg-transparent hover:bg-slate-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              {cancelling ? 'Anulando...' : 'Confirmar anulación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
