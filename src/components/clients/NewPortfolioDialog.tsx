'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface NewPortfolioDialogProps {
  clientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CUSTODIAN_TYPES = [
  { value: 'ALYCE',         label: 'ALyC (broker local)' },
  { value: 'EXCHANGE_CEX',  label: 'Exchange CEX' },
  { value: 'WALLET_HW',     label: 'Hardware Wallet' },
  { value: 'WALLET_SW',     label: 'Software Wallet' },
  { value: 'DEFI_PROTOCOL', label: 'Protocolo DeFi' },
  { value: 'EARN_PLATFORM', label: 'Plataforma Earn' },
  { value: 'OTRO',          label: 'Otro' },
]

const BASE_CURRENCIES = [
  { value: 'ARS',     label: 'ARS — Pesos' },
  { value: 'USD_MEP', label: 'USD MEP' },
  { value: 'USD_CCL', label: 'USD CCL' },
]

export default function NewPortfolioDialog({
  clientId, open, onOpenChange,
}: NewPortfolioDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    base_currency: 'ARS',
    custodian_type: 'ALYCE',
    custodian_name: '',
    account_identifier: '',
    blockchain_network: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.custodian_name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('portfolios').insert({
      client_id:          clientId,
      name:               form.name.trim(),
      description:        form.description.trim() || null,
      base_currency:      form.base_currency as 'ARS' | 'USD_MEP' | 'USD_CCL',
      custodian_type:     form.custodian_type,
      custodian_name:     form.custodian_name.trim(),
      account_identifier: form.account_identifier.trim() || null,
      blockchain_network: form.blockchain_network.trim() || null,
    })

    setLoading(false)

    if (error) {
      toast.error(`Error: ${error.message}`)
      return
    }

    toast.success(`Portfolio "${form.name}" creado`)
    onOpenChange(false)
    setForm({ name: '', description: '', base_currency: 'ARS', custodian_type: 'ALYCE', custodian_name: '', account_identifier: '', blockchain_network: '' })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Nuevo Portfolio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-slate-300">Nombre *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required
              className="bg-slate-800 border-slate-700 text-slate-100" />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Descripción</Label>
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Moneda base</Label>
              <Select value={form.base_currency} onValueChange={v => set('base_currency', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {BASE_CURRENCIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Tipo custodio</Label>
              <Select value={form.custodian_type} onValueChange={v => set('custodian_type', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                  {CUSTODIAN_TYPES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Nombre del custodio *</Label>
            <Input value={form.custodian_name} onChange={e => set('custodian_name', e.target.value)}
              required placeholder="IOL, Binance, MetaMask…"
              className="bg-slate-800 border-slate-700 text-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Identificador de cuenta</Label>
              <Input value={form.account_identifier} onChange={e => set('account_identifier', e.target.value)}
                placeholder="Nro. cuenta / email"
                className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Red blockchain</Label>
              <Input value={form.blockchain_network} onChange={e => set('blockchain_network', e.target.value)}
                placeholder="ethereum, solana…"
                className="bg-slate-800 border-slate-700 text-slate-100" />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-200">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
