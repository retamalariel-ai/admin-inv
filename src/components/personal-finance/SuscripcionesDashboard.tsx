'use client'

import { useState } from 'react'
import { RefreshCcw, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type SubRow = {
  id: string
  name: string
  amount: number
  currency: string
  frequency: 'SEMANAL' | 'MENSUAL' | 'ANUAL'
  next_due_date: string | null
  card_id: string | null
  category_id: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  personal_cards: { name: string } | null
  personal_categories: { name: string; icon: string | null } | null
}

export type CardRef = { id: string; name: string }
export type CatRef  = { id: string; name: string; icon: string | null }

interface Props {
  initialSubs: SubRow[]
  cards:       CardRef[]
  categories:  CatRef[]
  fxMep:       number | null
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const FREQ_SECTIONS: { key: 'MENSUAL' | 'ANUAL' | 'SEMANAL'; label: string }[] = [
  { key: 'MENSUAL', label: 'Mensual'  },
  { key: 'ANUAL',   label: 'Anual'    },
  { key: 'SEMANAL', label: 'Semanal'  },
]

const FREQ_BADGE: Record<string, string> = {
  MENSUAL: 'bg-blue-900/60 text-blue-300',
  ANUAL:   'bg-violet-900/60 text-violet-300',
  SEMANAL: 'bg-amber-900/60 text-amber-300',
}

const CURRENCIES = ['ARS', 'USD', 'USDT', 'EUR']

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  name:          '',
  amount:        '',
  currency:      'ARS',
  frequency:     'MENSUAL' as 'SEMANAL' | 'MENSUAL' | 'ANUAL',
  next_due_date: today(),
  card_id:       '',
  category_id:   '',
  notes:         '',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function fmtAmount(amount: number, currency: string) {
  if (currency === 'ARS') return fmtARS(amount)
  return amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
}

function toARS(amount: number, currency: string, mep: number | null): number | null {
  if (currency === 'ARS') return amount
  if ((currency === 'USD' || currency === 'USDT') && mep) return amount * mep
  return null
}

function toMonthlyARS(amount: number, currency: string, frequency: string, mep: number | null): number {
  const ars = toARS(amount, currency, mep) ?? 0
  if (frequency === 'MENSUAL') return ars
  if (frequency === 'ANUAL')   return ars / 12
  if (frequency === 'SEMANAL') return ars * 4.33
  return 0
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()
  return Math.ceil(diff / 86_400_000)
}

function addPeriod(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (frequency === 'MENSUAL') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'ANUAL')   d.setFullYear(d.getFullYear() + 1)
  else if (frequency === 'SEMANAL') d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function fmtDate(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[10px] text-muted-foreground/50">Sin fecha</span>
  if (days < 0)     return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">Vencida</span>
  if (days === 0)   return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">Hoy</span>
  if (days <= 7)    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-900/60 text-red-300">{days}d</span>
  if (days <= 30)   return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">{days}d</span>
  return              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{days}d</span>
}

function FormInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input {...props} className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  )
}

function FormSelect({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select {...props} className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
        {children}
      </select>
    </div>
  )
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function SuscripcionesDashboard({ initialSubs, cards, categories, fxMep }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [subs,        setSubs]        = useState<SubRow[]>(initialSubs)
  const [loading,     setLoading]     = useState<string | null>(null)
  const [pendingRenew, setPendingRenew] = useState<string | null>(null)

  // Modal
  const [open,   setOpen]   = useState(false)
  const [editSub, setEditSub] = useState<SubRow | null>(null)
  const [form,   setForm]   = useState(EMPTY_FORM)
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }))

  function openNew() {
    setEditSub(null); setForm({ ...EMPTY_FORM, next_due_date: today() }); setOpen(true)
  }

  function openEdit(sub: SubRow) {
    setEditSub(sub)
    setForm({
      name:          sub.name,
      amount:        String(sub.amount),
      currency:      sub.currency,
      frequency:     sub.frequency,
      next_due_date: sub.next_due_date ?? today(),
      card_id:       sub.card_id ?? '',
      category_id:   sub.category_id ?? '',
      notes:         sub.notes ?? '',
    })
    setOpen(true)
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function saveSub() {
    if (!form.name.trim() || !form.amount) {
      toast.error('Nombre y monto son requeridos'); return
    }
    setLoading('sub')
    const payload = {
      name:          form.name.trim(),
      amount:        parseFloat(form.amount),
      currency:      form.currency,
      frequency:     form.frequency,
      next_due_date: form.next_due_date || null,
      card_id:       form.card_id     || null,
      category_id:   form.category_id || null,
      notes:         form.notes.trim() || null,
    }

    try {
      if (editSub) {
        const { data, error } = await db
          .from('personal_subscriptions')
          .update(payload)
          .eq('id', editSub.id)
          .select('*, personal_cards(name), personal_categories(name, icon)')
          .single()
        if (error) throw error
        setSubs(prev => prev.map(s => s.id === editSub.id ? data : s))
        toast.success('Suscripción actualizada')
      } else {
        const { data, error } = await db
          .from('personal_subscriptions')
          .insert({ ...payload, is_active: true })
          .select('*, personal_cards(name), personal_categories(name, icon)')
          .single()
        if (error) throw error
        setSubs(prev => [...prev, data])
        toast.success('Suscripción creada')
      }
      setOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  async function deleteSub(id: string) {
    if (!confirm('¿Eliminar esta suscripción?')) return
    setLoading('del-' + id)
    const { error } = await db.from('personal_subscriptions').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setSubs(prev => prev.filter(s => s.id !== id))
    toast.success('Suscripción eliminada')
    setLoading(null)
  }

  async function confirmRenew(sub: SubRow) {
    const newDate = addPeriod(sub.next_due_date ?? today(), sub.frequency)
    setLoading('ren-' + sub.id)
    // Optimistic
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, next_due_date: newDate } : s))
    const { error } = await db.from('personal_subscriptions').update({ next_due_date: newDate }).eq('id', sub.id)
    if (error) {
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, next_due_date: sub.next_due_date } : s))
      toast.error(error.message)
    } else {
      toast.success(`Renovada → ${fmtDate(newDate)}`)
    }
    setLoading(null)
    setPendingRenew(null)
  }

  // ── Totalizador ────────────────────────────────────────────────────────────
  const mensualTotal = subs.reduce((sum, s) => sum + toMonthlyARS(s.amount, s.currency, s.frequency, fxMep), 0)
  const anualTotal   = mensualTotal * 12

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Suscripciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {subs.length} servicio{subs.length !== 1 ? 's' : ''}
            {fxMep ? ` · MEP $${Math.round(fxMep).toLocaleString('es-AR')}` : ''}
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva suscripción
        </Button>
      </div>

      {/* Empty state */}
      {subs.length === 0 && (
        <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCcw className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin suscripciones registradas</p>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nueva suscripción
          </Button>
        </div>
      )}

      {/* Secciones por frecuencia */}
      {FREQ_SECTIONS.map(({ key, label }) => {
        const items = subs.filter(s => s.frequency === key)
        if (items.length === 0) return null

        return (
          <div key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">{label}</p>
              <span className="text-[10px] text-muted-foreground/50">({items.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(sub => {
                const days    = daysUntil(sub.next_due_date)
                const arsEq   = toARS(sub.amount, sub.currency, fxMep)
                const urgent  = days !== null && days <= 7
                const isPending = pendingRenew === sub.id

                return (
                  <div
                    key={sub.id}
                    className={`rounded-lg bg-card border p-5 space-y-3 transition-colors ${
                      urgent ? 'border-red-500/40' : 'border-border'
                    }`}
                  >
                    {/* Nombre + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{sub.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FREQ_BADGE[sub.frequency]}`}>
                            {label}
                          </span>
                          {sub.personal_categories && (
                            <span className="text-[10px] text-muted-foreground/70">
                              {sub.personal_categories.icon ? sub.personal_categories.icon + ' ' : ''}
                              {sub.personal_categories.name}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Acciones */}
                      <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => openEdit(sub)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteSub(sub.id)} disabled={loading === 'del-' + sub.id} className="p-1 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Monto */}
                    <div>
                      <p className="text-xl font-semibold tabular-nums text-foreground">
                        {fmtAmount(sub.amount, sub.currency)}
                      </p>
                      {arsEq !== null && sub.currency !== 'ARS' && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">≈ {fmtARS(arsEq)} al MEP</p>
                      )}
                    </div>

                    {/* Vencimiento + tarjeta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                      <div className="flex items-center gap-1.5">
                        {sub.next_due_date && (
                          <span className="tabular-nums">{fmtDate(sub.next_due_date)}</span>
                        )}
                        <DaysBadge days={days} />
                      </div>
                      {sub.personal_cards && (
                        <span className="text-[10px] truncate max-w-[100px] text-muted-foreground/70">
                          {sub.personal_cards.name}
                        </span>
                      )}
                    </div>

                    {/* Botón Renovar (inline confirm) */}
                    {isPending ? (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">
                          → {fmtDate(addPeriod(sub.next_due_date ?? today(), sub.frequency))}
                        </span>
                        <button
                          onClick={() => confirmRenew(sub)}
                          disabled={loading === 'ren-' + sub.id}
                          className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-30"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setPendingRenew(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPendingRenew(sub.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Renovar
                      </button>
                    )}

                    {/* Notas */}
                    {sub.notes && (
                      <p className="text-[10px] text-muted-foreground/50 truncate">{sub.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Totalizador */}
      {subs.length > 0 && (
        <div className="rounded-lg bg-card border border-border p-5">
          <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-3">
            Costo proyectado en ARS equivalente
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Mensual</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{fmtARS(mensualTotal)}</p>
              {!fxMep && <p className="text-[10px] text-amber-400/70 mt-1">Sin tipo de cambio — sólo ARS incluidos</p>}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Anual proyectado</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{fmtARS(anualTotal)}</p>
            </div>
          </div>
          {fxMep && (
            <p className="text-[10px] text-muted-foreground/50 mt-3">
              USD/USDT al MEP ${Math.round(fxMep).toLocaleString('es-AR')}
              {' · '}Semanales × 4.33 · Anuales ÷ 12
            </p>
          )}
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editSub ? 'Editar suscripción' : 'Nueva suscripción'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); saveSub() }} className="space-y-4 mt-2">
            <FormInput
              label="Nombre *"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Netflix, Spotify, AWS…"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Monto *"
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0"
                required
              />
              <FormSelect label="Moneda" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormSelect label="Frecuencia" value={form.frequency} onChange={e => set('frequency', e.target.value as typeof form.frequency)}>
                <option value="MENSUAL">Mensual</option>
                <option value="ANUAL">Anual</option>
                <option value="SEMANAL">Semanal</option>
              </FormSelect>
              <FormInput
                label="Próximo vencimiento"
                type="date"
                value={form.next_due_date}
                onChange={e => set('next_due_date', e.target.value)}
              />
            </div>

            <FormSelect label="Tarjeta (opcional)" value={form.card_id} onChange={e => set('card_id', e.target.value)}>
              <option value="">Sin tarjeta</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FormSelect>

            <FormSelect label="Categoría" value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
              ))}
            </FormSelect>

            <FormInput
              label="Notas (opcional)"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Info adicional"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading === 'sub'}>
                {loading === 'sub' ? 'Guardando…' : editSub ? 'Guardar cambios' : 'Crear suscripción'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
