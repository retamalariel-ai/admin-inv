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

interface NewClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NewClientDialog({ open, onOpenChange }: NewClientDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    cuit: '',
    email: '',
    phone: '',
    risk_profile: 'MODERADO',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.from('clients').insert({
      full_name:    form.full_name.trim(),
      cuit:         form.cuit.trim() || null,
      email:        form.email.trim() || null,
      phone:        form.phone.trim() || null,
      risk_profile: form.risk_profile,
      notes:        form.notes.trim() || null,
    })

    setLoading(false)

    if (error) {
      toast.error(`Error al crear cliente: ${error.message}`)
      return
    }

    toast.success(`${form.full_name} agregado correctamente`)
    onOpenChange(false)
    setForm({ full_name: '', cuit: '', email: '', phone: '', risk_profile: 'MODERADO', notes: '' })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Nuevo Cliente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-slate-300">Nombre completo *</Label>
            <Input
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              required
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">CUIT</Label>
            <Input
              value={form.cuit}
              onChange={e => set('cuit', e.target.value)}
              placeholder="20-12345678-9"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Teléfono</Label>
              <Input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Perfil de riesgo</Label>
            <Select value={form.risk_profile} onValueChange={v => set('risk_profile', v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectItem value="CONSERVADOR">Conservador</SelectItem>
                <SelectItem value="MODERADO">Moderado</SelectItem>
                <SelectItem value="AGRESIVO">Agresivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-300">Notas</Label>
            <Input
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
