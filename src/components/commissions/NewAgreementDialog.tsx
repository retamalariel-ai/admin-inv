'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input }  from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'

const schema = z.object({
  client_id:       z.string().min(1, 'Requerido'),
  commission_type: z.enum(['PORCENTAJE_AUM', 'PORCENTAJE_GANANCIA', 'FEE_FIJO_MENSUAL', 'FEE_POR_OPERACION']),
  rate:            z.string().optional(),
  fixed_amount:    z.string().optional(),
  currency:        z.string(),
  high_water_mark: z.string().optional(),
  effective_from:  z.string().min(1, 'Requerido'),
  notes:           z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Client { id: string; full_name: string }

interface Props {
  open:       boolean
  onOpenChange: (v: boolean) => void
  clients:    Client[]
  onSuccess:  () => void
}

export default function NewAgreementDialog({ open, onOpenChange, clients, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      commission_type: 'PORCENTAJE_AUM',
      currency:        'ARS',
      effective_from:  new Date().toISOString().slice(0, 10),
    },
  })

  const commType = form.watch('commission_type')
  const isRate   = commType === 'PORCENTAJE_AUM' || commType === 'PORCENTAJE_GANANCIA'
  const isFixed  = commType === 'FEE_FIJO_MENSUAL' || commType === 'FEE_POR_OPERACION'
  const isHWM    = commType === 'PORCENTAJE_GANANCIA'

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('commission_agreements').insert({
        client_id:       values.client_id,
        commission_type: values.commission_type,
        rate:            isRate && values.rate ? parseFloat(values.rate) / 100 : null,
        fixed_amount:    isFixed && values.fixed_amount ? parseFloat(values.fixed_amount) : null,
        currency:        values.currency as any,
        high_water_mark: isHWM && values.high_water_mark ? parseFloat(values.high_water_mark) : 0,
        effective_from:  values.effective_from,
        notes:           values.notes || null,
      })
      if (error) throw error
      toast.success('Acuerdo creado')
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (e: any) {
      toast.error(e.message ?? 'Error al crear acuerdo')
    } finally {
      setSubmitting(false)
    }
  }

  const COMM_TYPE_LABELS = {
    PORCENTAJE_AUM:       '% AUM anual',
    PORCENTAJE_GANANCIA:  '% Ganancia (performance fee)',
    FEE_FIJO_MENSUAL:     'Fee fijo mensual',
    FEE_POR_OPERACION:    'Fee por operación',
  }

  const CURRENCIES = ['ARS', 'USD_MEP', 'USD_CCL', 'USD_CABLE']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Acuerdo de Comisión</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="client_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Seleccioná un cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="commission_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-slate-800 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(COMM_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {isRate && (
              <FormField control={form.control} name="rate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate anual (%)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="ej: 1.5 para 1.5% anual"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {isFixed && (
              <FormField control={form.control} name="fixed_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto fijo</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="ej: 50000"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {isHWM && (
              <FormField control={form.control} name="high_water_mark" render={({ field }) => (
                <FormItem>
                  <FormLabel>High Water Mark (ARS)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="0"
                      className="bg-slate-800 border-slate-600" />
                  </FormControl>
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
                      {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="effective_from" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vigente desde</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" className="bg-slate-800 border-slate-600" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} className="bg-slate-800 border-slate-600 resize-none"
                    placeholder="Observaciones adicionales..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? 'Guardando...' : 'Crear Acuerdo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
