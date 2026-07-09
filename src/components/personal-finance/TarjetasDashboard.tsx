'use client'

import { useState } from 'react'
import { CreditCard, Plus, Pencil, Trash2, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button }  from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type CardRow = {
  id: string; name: string; bank: string | null; card_type: string | null
  currency: string; closing_day: number | null; due_day: number | null
  credit_limit: number | null; is_active: boolean
}

export type InstRow = {
  id: string; card_id: string | null; category_id: string | null
  description: string; total_amount: number; installment_amount: number
  currency: string; total_installments: number; paid_installments: number
  start_date: string; is_active: boolean
  personal_categories: { name: string; icon: string | null } | null
}

export type CatRow = { id: string; name: string; icon: string | null }

interface Props {
  initialCards:        CardRow[]
  initialInstallments: InstRow[]
  categories:          CatRow[]
}

// ── Constantes ────────────────────────────────────────────────────────────────
const CARD_ACCENT: Record<string, string> = {
  VISA:       'border-l-emerald-500',
  MASTERCARD: 'border-l-red-500',
  AMEX:       'border-l-blue-500',
  EXTRANJERA: 'border-l-purple-500',
  OTRO:       'border-l-slate-500',
}

const CARD_BADGE: Record<string, string> = {
  VISA:       'bg-emerald-900/60 text-emerald-300',
  MASTERCARD: 'bg-red-900/60 text-red-300',
  AMEX:       'bg-blue-900/60 text-blue-300',
  EXTRANJERA: 'bg-purple-900/60 text-purple-300',
  OTRO:       'bg-slate-700/60 text-slate-300',
}

const CARD_TYPES  = ['VISA', 'MASTERCARD', 'AMEX', 'EXTRANJERA', 'OTRO']
const EMPTY_CARD  = { name:'', bank:'', card_type:'VISA', currency:'ARS', closing_day:'', due_day:'', credit_limit:'' }
const EMPTY_INST  = (cardId = '') => ({
  card_id:'', category_id:'', description:'',
  total_amount:'', installment_amount:'', currency:'ARS',
  total_installments:'', paid_installments:'0',
  start_date: new Date().toISOString().slice(0, 10),
  card_id_default: cardId,
})

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function FormInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        {...props}
        className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}

function FormSelect({ label, children, ...props }: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        {...props}
        className="w-full bg-muted/30 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {children}
      </select>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function TarjetasDashboard({ initialCards, initialInstallments, categories }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [cards,        setCards]        = useState<CardRow[]>(initialCards)
  const [installments, setInstallments] = useState<InstRow[]>(initialInstallments)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [loading,      setLoading]      = useState<string | null>(null)

  // Dialog: tarjeta
  const [cardOpen, setCardOpen] = useState(false)
  const [editCard, setEditCard] = useState<CardRow | null>(null)
  const [cardForm, setCardForm] = useState(EMPTY_CARD)
  const setCard = (key: string, val: string) => setCardForm(f => ({ ...f, [key]: val }))

  // Dialog: cuota
  const [instOpen, setInstOpen] = useState(false)
  const [instForm, setInstForm] = useState(EMPTY_INST())
  const setInst = (key: string, val: string) => setInstForm(f => ({ ...f, [key]: val }))

  // ── Handlers: tarjetas ─────────────────────────────────────────────────────
  function openNewCard() {
    setEditCard(null); setCardForm(EMPTY_CARD); setCardOpen(true)
  }

  function openEditCard(card: CardRow) {
    setEditCard(card)
    setCardForm({
      name:         card.name,
      bank:         card.bank ?? '',
      card_type:    card.card_type ?? 'VISA',
      currency:     card.currency,
      closing_day:  String(card.closing_day ?? ''),
      due_day:      String(card.due_day ?? ''),
      credit_limit: String(card.credit_limit ?? ''),
    })
    setCardOpen(true)
  }

  async function saveCard() {
    if (!cardForm.name.trim()) { toast.error('El nombre es requerido'); return }
    setLoading('card')
    const payload = {
      name:         cardForm.name.trim(),
      bank:         cardForm.bank.trim() || null,
      card_type:    cardForm.card_type,
      currency:     cardForm.currency,
      closing_day:  cardForm.closing_day  ? parseInt(cardForm.closing_day)   : null,
      due_day:      cardForm.due_day      ? parseInt(cardForm.due_day)        : null,
      credit_limit: cardForm.credit_limit ? parseFloat(cardForm.credit_limit) : null,
    }
    try {
      if (editCard) {
        const { error } = await db.from('personal_cards').update(payload).eq('id', editCard.id)
        if (error) throw error
        setCards(prev => prev.map(c => c.id === editCard.id ? { ...c, ...payload } : c))
        toast.success('Tarjeta actualizada')
      } else {
        const { data, error } = await db.from('personal_cards').insert({ ...payload, is_active: true }).select().single()
        if (error) throw error
        setCards(prev => [...prev, data])
        toast.success('Tarjeta creada')
      }
      setCardOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  async function deleteCard(id: string) {
    if (!confirm('¿Eliminar esta tarjeta y sus cuotas?')) return
    setLoading('del-' + id)
    const { error } = await db.from('personal_cards').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setCards(prev => prev.filter(c => c.id !== id))
    setInstallments(prev => prev.filter(i => i.card_id !== id))
    if (expandedCard === id) setExpandedCard(null)
    toast.success('Tarjeta eliminada')
    setLoading(null)
  }

  // ── Handlers: cuotas ──────────────────────────────────────────────────────
  function openNewInst(cardId = '') {
    setInstForm({ ...EMPTY_INST(cardId), card_id: cardId })
    setInstOpen(true)
  }

  async function saveInstallment() {
    const f = instForm
    if (!f.description.trim() || !f.installment_amount || !f.total_installments) {
      toast.error('Completá los campos obligatorios'); return
    }
    setLoading('inst')
    const payload = {
      card_id:            f.card_id || null,
      category_id:        f.category_id || null,
      description:        f.description.trim(),
      total_amount:       parseFloat(f.total_amount)       || 0,
      installment_amount: parseFloat(f.installment_amount),
      currency:           f.currency,
      total_installments: parseInt(f.total_installments),
      paid_installments:  parseInt(f.paid_installments)    || 0,
      start_date:         f.start_date,
      is_active:          true,
    }
    try {
      const { data, error } = await db.from('personal_installments').insert(payload).select('*, personal_categories(name, icon)').single()
      if (error) throw error
      setInstallments(prev => [...prev, data])
      toast.success('Cuota cargada')
      setInstOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  async function markPaid(inst: InstRow) {
    const newPaid = inst.paid_installments + 1
    setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, paid_installments: newPaid } : i))
    const { error } = await db.from('personal_installments').update({ paid_installments: newPaid }).eq('id', inst.id)
    if (error) {
      setInstallments(prev => prev.map(i => i.id === inst.id ? { ...i, paid_installments: inst.paid_installments } : i))
      toast.error(error.message)
    } else {
      toast.success('Cuota marcada como pagada')
    }
  }

  async function deleteInstallment(id: string) {
    if (!confirm('¿Eliminar esta cuota?')) return
    setInstallments(prev => prev.filter(i => i.id !== id))
    const { error } = await db.from('personal_installments').update({ is_active: false }).eq('id', id)
    if (error) toast.error(error.message)
    else toast.success('Cuota eliminada')
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const activeInsts = installments.filter(i => i.paid_installments < i.total_installments)

  function cardInsts(cardId: string)  { return activeInsts.filter(i => i.card_id === cardId) }
  function cardDebt(cardId: string)   { return cardInsts(cardId).reduce((s, i) => s + i.installment_amount * (i.total_installments - i.paid_installments), 0) }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Tarjetas y Cuotas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {cards.length} tarjeta{cards.length !== 1 ? 's' : ''} · {activeInsts.length} cuotas activas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => openNewInst()}>
            <Plus className="h-4 w-4" /> Nueva cuota
          </Button>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNewCard}>
            <CreditCard className="h-4 w-4" /> Nueva tarjeta
          </Button>
        </div>
      </div>

      {/* Grid de tarjetas */}
      {cards.length === 0 ? (
        <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
          <CreditCard className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin tarjetas. Agregá una para empezar.</p>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNewCard}>
            <Plus className="h-4 w-4" /> Nueva tarjeta
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map(card => {
            const debt   = cardDebt(card.id)
            const insts  = cardInsts(card.id)
            const isExp  = expandedCard === card.id
            const accent = CARD_ACCENT[card.card_type ?? 'OTRO'] ?? CARD_ACCENT.OTRO
            const badge  = CARD_BADGE[card.card_type  ?? 'OTRO'] ?? CARD_BADGE.OTRO

            return (
              <div key={card.id}>
                {/* Tarjeta */}
                <div className={`rounded-lg bg-card border border-border border-l-4 ${accent} p-5 space-y-4`}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{card.name}</p>
                      {card.bank && <p className="text-xs text-muted-foreground">{card.bank}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge}`}>
                        {card.card_type ?? 'OTRO'}
                      </span>
                      <button
                        onClick={() => openEditCard(card)}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteCard(card.id)}
                        disabled={loading === 'del-' + card.id}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30"
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Meta: cierre / vto / límite */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Cierre</p>
                      <p className="font-medium text-foreground">{card.closing_day ? `Día ${card.closing_day}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vto.</p>
                      <p className="font-medium text-foreground">{card.due_day ? `Día ${card.due_day}` : '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Límite</p>
                      <p className="font-medium text-foreground">
                        {card.credit_limit ? fmtARS(card.credit_limit) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Deuda + acciones */}
                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Deuda en cuotas</p>
                      <p className={`text-sm font-semibold tabular-nums ${debt > 0 ? 'text-amber-400' : 'text-muted-foreground/50'}`}>
                        {debt > 0 ? fmtARS(debt) : 'Sin deuda'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => openNewInst(card.id)}>
                        <Plus className="h-3 w-3" /> Cuota
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className={`h-7 px-2 text-xs gap-1 ${insts.length > 0 ? 'text-amber-400' : ''}`}
                        onClick={() => setExpandedCard(isExp ? null : card.id)}
                      >
                        {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {insts.length}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Lista de cuotas (expandible) */}
                {isExp && (
                  <div className="mt-1.5 rounded-lg bg-card border border-border divide-y divide-border">
                    {insts.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-muted-foreground/60">Sin cuotas activas para esta tarjeta</p>
                    ) : (
                      insts.map(inst => {
                        const remaining = inst.total_installments - inst.paid_installments
                        return (
                          <div key={inst.id} className="px-5 py-3 flex items-center gap-3">
                            {inst.personal_categories?.icon && (
                              <span className="text-sm shrink-0">{inst.personal_categories.icon}</span>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{inst.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {inst.paid_installments}/{inst.total_installments} cuotas
                                {' · '}{remaining} restante{remaining !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold tabular-nums text-amber-400">
                                {fmtARS(inst.installment_amount)}/cuota
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {fmtARS(inst.installment_amount * remaining)} total
                              </p>
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <button
                                onClick={() => markPaid(inst)}
                                title="Marcar cuota pagada"
                                className="p-1 text-muted-foreground hover:text-emerald-400 transition-colors"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteInstallment(inst.id)}
                                className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Dialog: Tarjeta ──────────────────────────────────────────────── */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editCard ? 'Editar tarjeta' : 'Nueva tarjeta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveCard() }} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormInput label="Nombre *" value={cardForm.name} onChange={e => setCard('name', e.target.value)} placeholder="Visa Galicia" required />
              </div>
              <div className="col-span-2">
                <FormInput label="Banco" value={cardForm.bank} onChange={e => setCard('bank', e.target.value)} placeholder="Galicia" />
              </div>
              <FormSelect label="Tipo" value={cardForm.card_type} onChange={e => setCard('card_type', e.target.value)}>
                {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </FormSelect>
              <FormSelect label="Moneda" value={cardForm.currency} onChange={e => setCard('currency', e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </FormSelect>
              <FormInput label="Día de cierre" type="number" min={1} max={31} value={cardForm.closing_day} onChange={e => setCard('closing_day', e.target.value)} placeholder="1–31" />
              <FormInput label="Día de vencimiento" type="number" min={1} max={31} value={cardForm.due_day} onChange={e => setCard('due_day', e.target.value)} placeholder="1–31" />
              <div className="col-span-2">
                <FormInput label="Límite de crédito (opcional)" type="number" min={0} value={cardForm.credit_limit} onChange={e => setCard('credit_limit', e.target.value)} placeholder="500000" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCardOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading === 'card'}>
                {loading === 'card' ? 'Guardando…' : editCard ? 'Guardar cambios' : 'Crear tarjeta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Cuota ─────────────────────────────────────────────────── */}
      <Dialog open={instOpen} onOpenChange={setInstOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva cuota</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveInstallment() }} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormSelect label="Tarjeta" value={instForm.card_id} onChange={e => setInst('card_id', e.target.value)}>
                  <option value="">Sin tarjeta</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </FormSelect>
              </div>
              <div className="col-span-2">
                <FormSelect label="Categoría" value={instForm.category_id} onChange={e => setInst('category_id', e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>)}
                </FormSelect>
              </div>
              <div className="col-span-2">
                <FormInput label="Descripción *" value={instForm.description} onChange={e => setInst('description', e.target.value)} placeholder="iPhone 15 — Frávega" required />
              </div>
              <FormInput label="Monto total" type="number" min={0} step="0.01" value={instForm.total_amount} onChange={e => setInst('total_amount', e.target.value)} placeholder="120000" />
              <FormInput label="Monto por cuota *" type="number" min={0} step="0.01" value={instForm.installment_amount} onChange={e => setInst('installment_amount', e.target.value)} placeholder="10000" required />
              <FormSelect label="Moneda" value={instForm.currency} onChange={e => setInst('currency', e.target.value)}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </FormSelect>
              <FormInput label="Total cuotas *" type="number" min={1} value={instForm.total_installments} onChange={e => setInst('total_installments', e.target.value)} placeholder="12" required />
              <FormInput label="Ya pagadas" type="number" min={0} value={instForm.paid_installments} onChange={e => setInst('paid_installments', e.target.value)} placeholder="0" />
              <div className="col-span-2">
                <FormInput label="Fecha de inicio" type="date" value={instForm.start_date} onChange={e => setInst('start_date', e.target.value)} required />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setInstOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading === 'inst'}>
                {loading === 'inst' ? 'Guardando…' : 'Cargar cuota'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
