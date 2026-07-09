'use client'

import { useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type TxRow = {
  id: string
  account_id: string | null
  card_id: string | null
  category_id: string | null
  type: 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA'
  amount: number
  currency: string
  fx_rate: number | null
  amount_ars: number | null
  description: string | null
  date: string
  notes: string | null
  created_at: string
  personal_categories: { name: string; icon: string | null } | null
  personal_accounts: { name: string } | null
}

export type AccRow = { id: string; name: string; currency: string }
export type CatRow = { id: string; name: string; type: string; icon: string | null }

interface FxRates { mep: number | null; ccl: number | null }

interface Props {
  initialTransactions: TxRow[]
  accounts:            AccRow[]
  categories:          CatRow[]
  fx:                  FxRates
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20

const TYPE_BADGE: Record<string, string> = {
  INGRESO:       'bg-emerald-900/60 text-emerald-300',
  EGRESO:        'bg-red-900/60 text-red-300',
  TRANSFERENCIA: 'bg-blue-900/60 text-blue-300',
}

const TYPE_LABEL: Record<string, string> = {
  INGRESO:       'Ingreso',
  EGRESO:        'Egreso',
  TRANSFERENCIA: 'Transfer.',
}

const CURRENCIES = ['ARS', 'USD', 'USDT', 'EUR']

const today = () => new Date().toISOString().slice(0, 10)
const currentYM = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function last12Months(): { value: string; label: string }[] {
  const months = []
  const d = new Date()
  for (let i = 0; i < 14; i++) {
    const y = d.getFullYear()
    const m = d.getMonth()
    const label = new Date(y, m, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    months.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label })
    d.setMonth(d.getMonth() - 1)
  }
  return months
}

const EMPTY_FORM = {
  type:           'EGRESO' as 'INGRESO' | 'EGRESO' | 'TRANSFERENCIA',
  date:           today(),
  description:    '',
  category_id:    '',
  account_id:     '',
  to_account_id:  '',   // TRANSFERENCIA: cuenta destino
  amount:         '',
  currency:       'ARS',
  fx_rate:        '',
  notes:          '',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function fmtMonto(amount: number, currency: string) {
  if (currency === 'ARS')
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
  return amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
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

function FilterSelect({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
    >
      {children}
    </select>
  )
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function TransaccionesDashboard({ initialTransactions, accounts, categories, fx }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [transactions, setTransactions] = useState<TxRow[]>(initialTransactions)
  const [loading,      setLoading]      = useState<string | null>(null)

  // ── Filtros ────────────────────────────────────────────────────────────────
  const [fMonth, setFMonth] = useState(currentYM())
  const [fType,  setFType]  = useState('ALL')
  const [fCat,   setFCat]   = useState('ALL')
  const [fCur,   setFCur]   = useState('ALL')
  const [page,   setPage]   = useState(0)

  const months = useMemo(() => last12Months(), [])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (fMonth !== 'ALL' && !tx.date.startsWith(fMonth)) return false
      if (fType  !== 'ALL' && tx.type !== fType) return false
      if (fCat   !== 'ALL' && tx.category_id !== fCat) return false
      if (fCur   !== 'ALL' && tx.currency !== fCur) return false
      return true
    })
  }, [transactions, fMonth, fType, fCat, fCur])

  const paginated   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)

  function changeFilter(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(0) }
  }

  // ── Totales del período filtrado ────────────────────────────────────────────
  const totals = useMemo(() => {
    let ing = 0, egr = 0
    for (const tx of filtered) {
      if (tx.type === 'INGRESO') ing += tx.amount_ars ?? tx.amount
      else if (tx.type === 'EGRESO') egr += tx.amount_ars ?? tx.amount
    }
    return { ing, egr, net: ing - egr }
  }, [filtered])

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [open,    setOpen]    = useState(false)
  const [editTx,  setEditTx]  = useState<TxRow | null>(null)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm(f => ({ ...f, [k]: v }))

  function defaultFxRate(currency: string): string {
    if (currency === 'ARS')                                    return ''
    if ((currency === 'USD' || currency === 'USDT') && fx.mep) return String(Math.round(fx.mep))
    if (currency === 'EUR' && fx.ccl)                          return String(Math.round(fx.ccl))
    return ''
  }

  function onCurrencyChange(currency: string) {
    setForm(f => ({ ...f, currency, fx_rate: defaultFxRate(currency) }))
  }

  function openNew() {
    setEditTx(null)
    setForm({ ...EMPTY_FORM, date: today() })
    setOpen(true)
  }

  function openEdit(tx: TxRow) {
    setEditTx(tx)
    setForm({
      type:          tx.type,
      date:          tx.date,
      description:   tx.description ?? '',
      category_id:   tx.category_id ?? '',
      account_id:    tx.account_id ?? '',
      to_account_id: '',
      amount:        String(tx.amount),
      currency:      tx.currency,
      fx_rate:       tx.fx_rate != null ? String(tx.fx_rate) : '',
      notes:         tx.notes ?? '',
    })
    setOpen(true)
  }

  // Categorías filtradas por tipo seleccionado
  const filteredCats = useMemo(() => {
    if (form.type === 'TRANSFERENCIA') return []
    return categories.filter(c => c.type === form.type)
  }, [categories, form.type])

  async function saveTx() {
    if (!form.amount || !form.account_id) {
      toast.error('Monto y cuenta son requeridos'); return
    }
    setLoading('tx')

    const amount   = parseFloat(form.amount)
    const fxRate   = form.fx_rate ? parseFloat(form.fx_rate) : null
    const amtArs   = form.currency === 'ARS' ? amount : (fxRate ? amount * fxRate : null)

    // Para TRANSFERENCIA: append la cuenta destino a las notas
    let notes = form.notes.trim()
    if (form.type === 'TRANSFERENCIA' && form.to_account_id) {
      const destAcc = accounts.find(a => a.id === form.to_account_id)
      const prefix  = destAcc ? `→ ${destAcc.name}` : `→ cuenta`
      notes = notes ? `${prefix} | ${notes}` : prefix
    }

    const payload = {
      type:          form.type,
      date:          form.date,
      description:   form.description.trim() || null,
      category_id:   form.category_id || null,
      account_id:    form.account_id || null,
      amount,
      currency:      form.currency,
      fx_rate:       fxRate,
      amount_ars:    amtArs,
      notes:         notes || null,
    }

    try {
      if (editTx) {
        const { data, error } = await db
          .from('personal_transactions')
          .update(payload)
          .eq('id', editTx.id)
          .select('*, personal_categories(name, icon), personal_accounts(name)')
          .single()
        if (error) throw error
        setTransactions(prev => prev.map(t => t.id === editTx.id ? data : t))
        toast.success('Transacción actualizada')
      } else {
        const { data, error } = await db
          .from('personal_transactions')
          .insert(payload)
          .select('*, personal_categories(name, icon), personal_accounts(name)')
          .single()
        if (error) throw error
        // Insertar al principio (orden DESC)
        setTransactions(prev => [data, ...prev])
        toast.success('Transacción registrada')
      }
      setOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  async function deleteTx(id: string) {
    if (!confirm('¿Eliminar esta transacción?')) return
    setLoading('del-' + id)
    const { error } = await db.from('personal_transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setTransactions(prev => prev.filter(t => t.id !== id))
    toast.success('Transacción eliminada')
    setLoading(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const fmtARS = (n: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Transacciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · {transactions.length} total
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect value={fMonth} onChange={changeFilter(setFMonth)}>
          <option value="ALL">Todos los meses</option>
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect value={fType} onChange={changeFilter(setFType)}>
          <option value="ALL">Todos los tipos</option>
          <option value="INGRESO">Ingresos</option>
          <option value="EGRESO">Egresos</option>
          <option value="TRANSFERENCIA">Transferencias</option>
        </FilterSelect>

        <FilterSelect value={fCat} onChange={changeFilter(setFCat)}>
          <option value="ALL">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon ? c.icon + ' ' : ''}{c.name}</option>
          ))}
        </FilterSelect>

        <FilterSelect value={fCur} onChange={changeFilter(setFCur)}>
          <option value="ALL">Todas las monedas</option>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </FilterSelect>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-card">
            <ArrowLeftRight className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Sin transacciones para los filtros seleccionados</p>
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
              <Plus className="h-4 w-4" /> Registrar transacción
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Descripción</th>
                  <th className="text-left px-4 py-3">Categoría</th>
                  <th className="text-left px-4 py-3">Cuenta</th>
                  <th className="text-right px-4 py-3">Monto</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Moneda</th>
                  <th className="text-right px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {paginated.map(tx => {
                  const isIng = tx.type === 'INGRESO'
                  const isEgr = tx.type === 'EGRESO'
                  return (
                    <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                        {fmtDate(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE[tx.type] ?? ''}`}>
                          {TYPE_LABEL[tx.type] ?? tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="truncate text-foreground">{tx.description ?? <span className="text-muted-foreground/50 italic">sin descripción</span>}</p>
                        {tx.notes && (
                          <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{tx.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.personal_categories
                          ? <span>{tx.personal_categories.icon ? tx.personal_categories.icon + ' ' : ''}{tx.personal_categories.name}</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.personal_accounts?.name ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        <span className={`font-semibold ${isIng ? 'text-emerald-400' : isEgr ? 'text-red-400' : 'text-blue-400'}`}>
                          {isEgr ? '−' : isIng ? '+' : ''}{fmtMonto(tx.amount, tx.currency)}
                        </span>
                        {tx.currency !== 'ARS' && tx.amount_ars != null && (
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{fmtARS(tx.amount_ars)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {tx.currency}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-0.5">
                          <button
                            onClick={() => openEdit(tx)}
                            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTx(tx.id)}
                            disabled={loading === 'del-' + tx.id}
                            className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-border hover:bg-muted/30 disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded border border-border hover:bg-muted/30 disabled:opacity-30 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Totalizador */}
      {filtered.length > 0 && (
        <div className="rounded-lg bg-card border border-border p-4">
          <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-3">
            Resumen del período · importes en ARS equivalente
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Ingresos</p>
              <p className="text-base font-semibold tabular-nums text-emerald-400">{fmtARS(totals.ing)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Egresos</p>
              <p className="text-base font-semibold tabular-nums text-red-400">{fmtARS(totals.egr)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Balance neto</p>
              <p className={`text-base font-semibold tabular-nums ${totals.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.net >= 0 ? '+' : ''}{fmtARS(totals.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: transacción ─────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTx ? 'Editar transacción' : 'Nueva transacción'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); saveTx() }} className="space-y-4 mt-2">
            {/* Tipo + fecha */}
            <div className="grid grid-cols-2 gap-4">
              <FormSelect
                label="Tipo *"
                value={form.type}
                onChange={e => {
                  const t = e.target.value as typeof form.type
                  setForm(f => ({ ...f, type: t, category_id: '' }))
                }}
              >
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </FormSelect>
              <FormInput
                label="Fecha *"
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>

            {/* Descripción */}
            <FormInput
              label="Descripción"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Ej: Supermercado Coto"
            />

            {/* Categoría (solo si no es TRANSFERENCIA) */}
            {form.type !== 'TRANSFERENCIA' && (
              <FormSelect
                label="Categoría"
                value={form.category_id}
                onChange={e => set('category_id', e.target.value)}
              >
                <option value="">Sin categoría</option>
                {filteredCats.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? c.icon + ' ' : ''}{c.name}
                  </option>
                ))}
              </FormSelect>
            )}

            {/* Cuenta origen */}
            <FormSelect
              label={form.type === 'TRANSFERENCIA' ? 'Cuenta origen *' : 'Cuenta *'}
              value={form.account_id}
              onChange={e => set('account_id', e.target.value)}
            >
              <option value="">Seleccionar cuenta</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </FormSelect>

            {/* Cuenta destino (solo TRANSFERENCIA) */}
            {form.type === 'TRANSFERENCIA' && (
              <FormSelect
                label="Cuenta destino"
                value={form.to_account_id}
                onChange={e => set('to_account_id', e.target.value)}
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.filter(a => a.id !== form.account_id).map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
                ))}
              </FormSelect>
            )}

            {/* Monto + moneda */}
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
              <FormSelect
                label="Moneda"
                value={form.currency}
                onChange={e => onCurrencyChange(e.target.value)}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
            </div>

            {/* Tipo de cambio (solo si no es ARS) */}
            {form.currency !== 'ARS' && (
              <FormInput
                label={`Tipo de cambio (${form.currency} → ARS)${form.currency === 'EUR' ? ' — CCL referencial' : ' — MEP referencial'}`}
                type="number"
                min={0}
                step="0.01"
                value={form.fx_rate}
                onChange={e => set('fx_rate', e.target.value)}
                placeholder={form.currency === 'EUR' ? String(fx.ccl ?? '') : String(fx.mep ?? '')}
              />
            )}

            {/* Notas */}
            <FormInput
              label="Notas (opcional)"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Información adicional"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={loading === 'tx'}
              >
                {loading === 'tx' ? 'Guardando…' : editTx ? 'Guardar cambios' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
