'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Decimal from 'decimal.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form'
import { Input }    from '@/components/ui/input'
import { Button }   from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type Agreement = Database['public']['Tables']['commission_agreements']['Row'] & {
  client_name?: string | null
}

const schema = z.object({
  client_id:    z.string().min(1, 'Requerido'),
  agreement_id: z.string().min(1, 'Requerido'),
  period_from:  z.string().min(1, 'Requerido'),
  period_to:    z.string().min(1, 'Requerido'),
  aum_base:     z.string().optional(),
  gain_period:  z.string().optional(),
  currency:     z.string(),
  fx_rate_used: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Client { id: string; full_name: string }

interface Props {
  open:         boolean
  onOpenChange: (v: boolean) => void
  clients:      Client[]
  agreements:   Agreement[]
  onSuccess:    () => void
}

function calcAmount(agreement: Agreement, values: FormValues): Decimal | null {
  const aum   = values.aum_base   ? new Decimal(values.aum_base)  : null
  const gain  = values.gain_period ? new Decimal(values.gain_period) : null
  const from  = new Date(values.period_from)
  const to    = new Date(values.period_to)
  const days  = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000))

  switch (agreement.commission_type) {
    case 'PORCENTAJE_AUM':
      if (aum && agreement.rate) {
        return aum.mul(new Decimal(agreement.rate)).mul(new Decimal(days / 365))
      }
      return null
    case 'PORCENTAJE_GANANCIA':
      if (gain && agreement.rate) {
        const hwm = new Decimal(agreement.high_water_mark ?? 0)
        if (gain.gt(hwm)) {
          return gain.minus(hwm).mul(new Decimal(agreement.rate))
        }
        return new Decimal(0)
      }
      return null
    case 'FEE_FIJO_MENSUAL':
      return agreement.fixed_amount ? new Decimal(agreement.fixed_amount) : null
    case 'FEE_POR_OPERACION':
      return agreement.fixed_amount ? new Decimal(agreement.fixed_amount) : null
    default:
      return null
  }
}

export default function NewRecordDialog({ open, onOpenChange, clients, agreements, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [calculated, setCalculated] = useState<string | null>(null)

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      currency:    'ARS',
      period_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
      period_to:   new Date().toISOString().slice(0, 10),
    },
  })

  const clientId    = form.watch('client_id')
  const agreementId = form.watch('agreement_id')
  const aumBase     = form.watch('aum_base')
  const gainPeriod  = form.watch('gain_period')
  const periodFrom  = form.watch('period_from')
  const periodTo    = form.watch('period_to')

  const clientAgreements = agreements.filter(a => a.client_id === clientId)
  const selectedAgreement = agreements.find(a => a.id === agreementId)

  // Recalcular automáticamente
  useEffect(() => {
    if (!selectedAgreement || !periodFrom || !periodTo) return
    const values = form.getValues()
    const amount = calcAmount(selectedAgreement, values)
    setCalculated(amount ? amount.toFixed(2) : null)
  }, [agreementId, aumBase, gainPeriod, periodFrom, periodTo, selectedAgreement, form])

  async function onSubmit(values: FormValues) {
    if (!selectedAgreement) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const amount = calcAmount(selectedAgreement, values)
      if (!amount) throw new Error('No se pudo calcular el monto. Verificá los campos.')

      const { error } = await supabase.from('commission_records').insert({
        client_id:          values.client_id,
        agreement_id:       values.agreement_id,
        period_from:        values.period_from,
        period_to:          values.period_to,
        aum_at_calculation: values.aum_base ? parseFloat(values.aum_base) : null,
        gain_in_period:     values.gain_period ? parseFloat(values.gain_period) : null,
        commission_amount:  amount.toNumber(),
        currency:           values.currency as any,
        fx_rate_used:       values.fx_rate_used ? parseFloat(values.fx_rate_used) : null,
        status:             'DEVENGADA',
      })
      if (error) throw error
      toast.success(`Comisión registrada: ${amount.toFixed(2)} ${values.currency}`)
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al registrar comisión')
    } finally {
      setSubmitting(false)
    }
  }

  const COMM_TYPE_LABELS: Record<string, string> = {
    PORCENTAJE_AUM:       '% AUM',
    PORCENTAJE_GANANCIA:  '% Ganancia',
    FEE_FIJO_MENSUAL:     'Fee Fijo',
    FEE_POR_OPERACION:    'Fee x Op.',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Comisión Devengada</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="client_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={v => { field.onChange(v); form.setValue('agreement_id', '') }}
                  value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Seleccioná un cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="agreement_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Acuerdo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!clientId}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder={clientId ? 'Seleccioná un acuerdo' : 'Primero elegí cliente'} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {clientAgreements.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {COMM_TYPE_LABELS[a.commission_type]} — desde {a.effective_from}
                        {a.rate != null && ` (${(a.rate * 100).toFixed(2)}%)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="period_from" render={({ field }) => (
                <FormItem>
                  <FormLabel>Período desde</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="period_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Período hasta</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {selectedAgreement && (selectedAgreement.commission_type === 'PORCENTAJE_AUM') && (
              <FormField control={form.control} name="aum_base" render={({ field }) => (
                <FormItem>
                  <FormLabel>AUM base del período</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="ARS o USD"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {selectedAgreement && selectedAgreement.commission_type === 'PORCENTAJE_GANANCIA' && (
              <FormField control={form.control} name="gain_period" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ganancia del período</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="Ganancia sobre HWM"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormDescription className="text-slate-500 text-xs">
                    HWM actual: {selectedAgreement.high_water_mark}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-800 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {['ARS', 'USD_MEP', 'USD_CCL'].map(c =>
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fx_rate_used" render={({ field }) => (
                <FormItem>
                  <FormLabel>TC usado (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="ej: 1450"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {calculated && (
              <div className="rounded-md bg-emerald-900/30 border border-emerald-700 px-4 py-3">
                <p className="text-xs text-emerald-400 font-medium">Monto calculado automáticamente</p>
                <p className="text-xl font-bold text-emerald-300 tabular-nums mt-1">
                  {parseFloat(calculated).toLocaleString('es-AR', { minimumFractionDigits: 2 })} {form.watch('currency')}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting || !calculated}
                className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? 'Guardando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
