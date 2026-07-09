'use client'

import { useState, useMemo } from 'react'
import { Pencil, ChevronDown, ChevronUp, Check, X, PieChart } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type CatRow = {
  id: string
  name: string
  icon: string | null
  budget_amount: number | null
}

export type TxSummary = {
  category_id: string | null
  amount:      number
  currency:    string
  amount_ars:  number | null
  date:        string
}

interface Props {
  initialCategories: CatRow[]
  allTransactions:   TxSummary[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const currentYM = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n)
}

function toARS(tx: TxSummary): number {
  return tx.currency === 'ARS' ? tx.amount : (tx.amount_ars ?? tx.amount)
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  const color =
    pct >= 100 ? 'bg-red-500' :
    pct >= 80  ? 'bg-amber-500' :
                 'bg-emerald-500'
  return (
    <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  )
}

function InlineBudgetEdit({
  value, onChange, onSave, onCancel
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={0}
        step={1000}
        autoFocus
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  onSave()
          if (e.key === 'Escape') onCancel()
        }}
        className="w-28 bg-muted/30 border border-primary/50 rounded px-2 py-1 text-sm text-foreground focus:outline-none"
      />
      <button onClick={onSave}   className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PresupuestoDashboard({ initialCategories, allTransactions }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [categories,  setCategories]  = useState<CatRow[]>(initialCategories)
  const [selectedYM,  setSelectedYM]  = useState(currentYM())
  const [showEmpty,   setShowEmpty]   = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [editValue,   setEditValue]   = useState('')
  const [saving,      setSaving]      = useState<string | null>(null)

  // ── Gasto del mes seleccionado ─────────────────────────────────────────────
  const spentByCat = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const tx of allTransactions) {
      if (!tx.date.startsWith(selectedYM)) continue
      const key = tx.category_id ?? '__none__'
      map[key] = (map[key] ?? 0) + toARS(tx)
    }
    return map
  }, [allTransactions, selectedYM])

  // ── Separar categorías ─────────────────────────────────────────────────────
  const { withBudget, withoutBudget } = useMemo(() => {
    const w: CatRow[] = [], wo: CatRow[] = []
    for (const c of categories) {
      if ((c.budget_amount ?? 0) > 0) w.push(c)
      else wo.push(c)
    }
    // Ordenar por % de ejecución DESC
    w.sort((a, b) => {
      const pa = ((spentByCat[a.id] ?? 0) / (a.budget_amount ?? 1)) * 100
      const pb = ((spentByCat[b.id] ?? 0) / (b.budget_amount ?? 1)) * 100
      return pb - pa
    })
    return { withBudget: w, withoutBudget: wo }
  }, [categories, spentByCat])

  // ── Resumen global ─────────────────────────────────────────────────────────
  const globalBudget = withBudget.reduce((s, c) => s + (c.budget_amount ?? 0), 0)
  const globalSpent  = withBudget.reduce((s, c) => s + (spentByCat[c.id] ?? 0), 0)
  const globalPct    = globalBudget > 0 ? (globalSpent / globalBudget) * 100 : 0

  // ── Edición inline del presupuesto ─────────────────────────────────────────
  function startEdit(cat: CatRow) {
    setEditingId(cat.id)
    setEditValue(cat.budget_amount != null && cat.budget_amount > 0 ? String(cat.budget_amount) : '')
  }

  async function saveBudget(catId: string) {
    const amount = parseFloat(editValue) || 0
    setSaving(catId)
    const { error } = await db
      .from('personal_categories')
      .update({ budget_amount: amount })
      .eq('id', catId)
    if (error) {
      toast.error(error.message)
    } else {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, budget_amount: amount } : c))
      toast.success(amount > 0 ? 'Presupuesto actualizado' : 'Presupuesto eliminado')
    }
    setSaving(null)
    setEditingId(null)
  }

  // Categorías sin presupuesto visibles (filtrado por showEmpty)
  const visibleWithout = withoutBudget.filter(c =>
    showEmpty || (spentByCat[c.id] ?? 0) > 0
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header + selector de mes */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Presupuesto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Seguimiento por categoría</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYM(m => addMonths(m, -1))}
            className="px-2.5 py-1 rounded border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            ←
          </button>
          <span className="text-sm font-medium text-foreground w-36 text-center capitalize">
            {monthLabel(selectedYM)}
          </span>
          <button
            onClick={() => setSelectedYM(m => addMonths(m, 1))}
            disabled={selectedYM >= currentYM()}
            className="px-2.5 py-1 rounded border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-30 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* Resumen global */}
      {withBudget.length > 0 && (
        <div className="rounded-lg bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
              Ejecución global
            </p>
            <span className={`text-sm font-semibold tabular-nums ${
              globalPct >= 100 ? 'text-red-400' : globalPct >= 80 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {globalPct.toFixed(1)}%
            </span>
          </div>

          <ProgressBar pct={globalPct} />

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Presupuestado</p>
              <p className="font-semibold tabular-nums text-foreground">{fmtARS(globalBudget)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Gastado</p>
              <p className={`font-semibold tabular-nums ${globalSpent > globalBudget ? 'text-red-400' : 'text-foreground'}`}>
                {fmtARS(globalSpent)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {globalSpent > globalBudget ? 'Excedido' : 'Restante'}
              </p>
              <p className={`font-semibold tabular-nums ${globalSpent > globalBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                {globalSpent > globalBudget ? '+' : ''}{fmtARS(Math.abs(globalBudget - globalSpent))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista: categorías CON presupuesto */}
      {withBudget.length === 0 ? (
        <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-16 gap-3">
          <PieChart className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Sin presupuestos asignados</p>
          <p className="text-xs text-muted-foreground/60">
            Hacé clic en "Asignar presupuesto" en una categoría de abajo
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
          {withBudget.map(cat => {
            const spent  = spentByCat[cat.id] ?? 0
            const budget = cat.budget_amount ?? 0
            const pct    = budget > 0 ? (spent / budget) * 100 : 0
            const remaining = budget - spent
            const isEditing = editingId === cat.id

            const amtColor =
              pct >= 100 ? 'text-red-400' :
              pct >= 80  ? 'text-amber-400' :
                           'text-emerald-400'

            return (
              <div key={cat.id} className="px-5 py-4 space-y-2.5">
                {/* Fila 1: nombre + % + editar */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {cat.icon && <span className="text-base shrink-0">{cat.icon}</span>}
                    <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold tabular-nums ${amtColor}`}>
                      {pct.toFixed(0)}%
                    </span>
                    {isEditing ? (
                      <InlineBudgetEdit
                        value={editValue}
                        onChange={setEditValue}
                        onSave={() => saveBudget(cat.id)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(cat)}
                        disabled={saving === cat.id}
                        className="p-1 text-muted-foreground/50 hover:text-foreground transition-colors disabled:opacity-30"
                        title="Editar presupuesto"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                <ProgressBar pct={pct} />

                {/* Fila 3: montos */}
                {!isEditing && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      Gastado: <span className={`font-medium ${pct >= 100 ? 'text-red-400' : 'text-foreground'}`}>{fmtARS(spent)}</span>
                      {' / '}{fmtARS(budget)}
                    </span>
                    <span className={`tabular-nums font-medium ${remaining < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {remaining < 0 ? `Excedido ${fmtARS(-remaining)}` : `Resta ${fmtARS(remaining)}`}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sección: categorías SIN presupuesto */}
      <div className="space-y-3">
        <button
          onClick={() => setShowEmpty(v => !v)}
          className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          {showEmpty ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Sin presupuesto asignado
          <span className="text-muted-foreground/50 font-normal normal-case tracking-normal">
            ({withoutBudget.length} categoría{withoutBudget.length !== 1 ? 's' : ''})
          </span>
        </button>

        {showEmpty && (
          <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
            {withoutBudget.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground/60">Todas las categorías tienen presupuesto asignado</p>
            ) : (
              withoutBudget.map(cat => {
                const spent     = spentByCat[cat.id] ?? 0
                const isEditing = editingId === cat.id
                const hasMov    = spent > 0

                return (
                  <div key={cat.id} className={`px-5 py-3.5 flex items-center justify-between gap-4 ${!hasMov ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {cat.icon && <span className="text-sm shrink-0">{cat.icon}</span>}
                      <span className="text-sm text-foreground truncate">{cat.name}</span>
                      {!hasMov && (
                        <span className="text-[10px] text-muted-foreground/50 ml-1">sin movimiento</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {spent > 0 && (
                        <span className="text-sm tabular-nums text-red-400 font-medium">{fmtARS(spent)}</span>
                      )}
                      {isEditing ? (
                        <InlineBudgetEdit
                          value={editValue}
                          onChange={setEditValue}
                          onSave={() => saveBudget(cat.id)}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(cat)}
                          disabled={saving === cat.id}
                          className="text-[11px] text-primary hover:underline underline-offset-2 disabled:opacity-30"
                        >
                          Asignar presupuesto
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Toggle "mostrar sin movimiento" */}
      {!showEmpty && withoutBudget.filter(c => (spentByCat[c.id] ?? 0) > 0).length > 0 && (
        <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
          <p className="px-5 py-3 text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">
            Gasto sin presupuesto
          </p>
          {withoutBudget
            .filter(c => (spentByCat[c.id] ?? 0) > 0)
            .map(cat => (
              <div key={cat.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  {cat.icon && <span className="text-sm shrink-0">{cat.icon}</span>}
                  <span className="text-sm text-foreground truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm tabular-nums text-red-400 font-medium">{fmtARS(spentByCat[cat.id] ?? 0)}</span>
                  {editingId === cat.id ? (
                    <InlineBudgetEdit
                      value={editValue}
                      onChange={setEditValue}
                      onSave={() => saveBudget(cat.id)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(cat)}
                      className="text-[11px] text-primary hover:underline underline-offset-2"
                    >
                      Asignar presupuesto
                    </button>
                  )}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}
