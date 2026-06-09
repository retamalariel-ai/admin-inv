'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Decimal from 'decimal.js'
import { Plus, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import NewAgreementDialog from './NewAgreementDialog'
import NewRecordDialog    from './NewRecordDialog'
import { createClient }   from '@/lib/supabase/client'
import type { Database }  from '@/types/database.types'

type Agreement     = Database['public']['Tables']['commission_agreements']['Row'] & { client_name?: string | null }
type CommRecord    = Database['public']['Tables']['commission_records']['Row'] & {
  client_name?:     string | null
  commission_type?: string | null
}
type Client = { id: string; full_name: string }
type CommStatus = Database['public']['Enums']['commission_status']

const STATUS_COLOR: Record<CommStatus, string> = {
  DEVENGADA: 'bg-yellow-900/60 text-yellow-300',
  COBRADA:   'bg-emerald-900/60 text-emerald-300',
  ANULADA:   'bg-red-900/60 text-red-300',
}

const COMM_TYPE_LABELS: Record<string, string> = {
  PORCENTAJE_AUM:      '% AUM',
  PORCENTAJE_GANANCIA: '% Ganancia',
  FEE_FIJO_MENSUAL:    'Fee Fijo',
  FEE_POR_OPERACION:   'Fee x Op.',
}

const D = (v: number | null) => new Decimal(v ?? 0)

interface Props {
  agreements: Agreement[]
  records:    CommRecord[]
  clients:    Client[]
}

export default function CommissionsDashboard({ agreements, records, clients }: Props) {
  const router = useRouter()
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [recordOpen,    setRecordOpen]    = useState(false)
  const [confirmId,     setConfirmId]     = useState<string | null>(null)

  const pendiente  = records.filter(r => r.status === 'DEVENGADA')
    .reduce((s, r) => s.plus(D(r.commission_amount)), new Decimal(0))

  const now        = new Date()
  const thisMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisYear   = String(now.getFullYear())

  const cobradoMes = records
    .filter(r => r.status === 'COBRADA' && r.period_to?.startsWith(thisMonth))
    .reduce((s, r) => s.plus(D(r.commission_amount)), new Decimal(0))

  const cobradoAno = records
    .filter(r => r.status === 'COBRADA' && r.period_to?.startsWith(thisYear))
    .reduce((s, r) => s.plus(D(r.commission_amount)), new Decimal(0))

  async function markCobrada(id: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('commission_records')
      .update({ status: 'COBRADA', collected_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marcado como cobrado')
    router.refresh()
  }

  const recordToConfirm = records.find(r => r.id === confirmId)

  function fmtAmount(amount: number, currency: string) {
    return `${new Decimal(amount).toFixed(2)} ${currency}`
  }

  return (
    <div className="space-y-8">
      {/* Sección 1: Acuerdos Vigentes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Acuerdos Vigentes ({agreements.length})
          </h2>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            onClick={() => setAgreementOpen(true)}>
            <Plus className="h-4 w-4" /> Nuevo Acuerdo
          </Button>
        </div>

        {agreements.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin acuerdos vigentes</p>
        ) : (
          <div className="rounded-lg border border-slate-700 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Rate / Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Vigente desde</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agreements.map(a => (
                  <TableRow key={a.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="text-slate-200">{a.client_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className="bg-slate-700/60 text-slate-300 text-xs">
                        {COMM_TYPE_LABELS[a.commission_type] ?? a.commission_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">
                      {a.rate != null
                        ? `${(a.rate * 100).toFixed(2)}% anual`
                        : a.fixed_amount != null
                          ? a.fixed_amount.toLocaleString('es-AR')
                          : '—'}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">{a.currency}</TableCell>
                    <TableCell className="text-slate-400 text-xs">{a.effective_from}</TableCell>
                    <TableCell className="text-slate-500 text-xs max-w-[200px] truncate">
                      {a.notes ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Sección 2: Resumen */}
      <section>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Comisiones Devengadas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-yellow-700/40">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Pendiente de cobro</p>
            <p className="text-xl font-bold text-yellow-300 tabular-nums">
              {pendiente.toFixed(2)} ARS
            </p>
            <p className="text-xs text-slate-500 mt-1">{pendiente.toFixed(0)} registros devengados</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-emerald-700/40">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cobrado este mes</p>
            <p className="text-xl font-bold text-emerald-300 tabular-nums">
              {cobradoMes.toFixed(2)} ARS
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Cobrado este año</p>
            <p className="text-xl font-bold text-slate-100 tabular-nums">
              {cobradoAno.toFixed(2)} ARS
            </p>
          </div>
        </div>
      </section>

      {/* Sección 3: Historial */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Historial (últimas 50)
          </h2>
          <Button size="sm" variant="outline" className="gap-2"
            onClick={() => setRecordOpen(true)}>
            <Plus className="h-4 w-4" /> Registrar comisión
          </Button>
        </div>

        <div className="rounded-lg border border-slate-700 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Moneda</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Sin registros
                  </TableCell>
                </TableRow>
              )}
              {records.map(r => (
                <TableRow key={r.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-200">{r.client_name ?? '—'}</TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {r.commission_type ? COMM_TYPE_LABELS[r.commission_type] ?? r.commission_type : '—'}
                  </TableCell>
                  <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                    {r.period_from} → {r.period_to}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-200 font-medium">
                    {fmtAmount(r.commission_amount, r.currency)}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs">{r.currency}</TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLOR[r.status as CommStatus]}`}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.status === 'DEVENGADA' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-400 hover:text-emerald-300 gap-1 h-7 px-2"
                        onClick={() => setConfirmId(r.id)}
                      >
                        <CheckCircle className="h-3 w-3" /> Cobrada
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Dialogs */}
      <NewAgreementDialog
        open={agreementOpen}
        onOpenChange={setAgreementOpen}
        clients={clients}
        onSuccess={() => router.refresh()}
      />
      <NewRecordDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        clients={clients}
        agreements={agreements}
        onSuccess={() => router.refresh()}
      />

      {/* Confirm cobrada */}
      <AlertDialog open={!!confirmId} onOpenChange={open => !open && setConfirmId(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar como cobrada?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {recordToConfirm && (
                <span>
                  Comisión de <strong>{recordToConfirm.client_name ?? 'cliente'}</strong> —{' '}
                  {fmtAmount(recordToConfirm.commission_amount, recordToConfirm.currency)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => { if (confirmId) markCobrada(confirmId); setConfirmId(null) }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
