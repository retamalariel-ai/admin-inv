'use client'

import { useState } from 'react'
import { Landmark, Plus, Pencil, Trash2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type AccountRow = {
  id: string; name: string; type: string; currency: string
  current_balance: number; owner: string; is_active: boolean
}

interface Props {
  initialAccounts: AccountRow[]
  fxMep: number | null
}

// ── Constantes ────────────────────────────────────────────────────────────────
const ACCOUNT_TYPES = [
  'BANCO_ARS', 'EFECTIVO_ARS', 'EFECTIVO_USD',
  'EFECTIVO_EUR', 'USDT_WALLET', 'CRYPTO_WALLET',
] as const

const TYPE_LABELS: Record<string, string> = {
  BANCO_ARS:     'Banco ARS',
  EFECTIVO_ARS:  'Efectivo ARS',
  EFECTIVO_USD:  'Efectivo USD',
  EFECTIVO_EUR:  'Efectivo EUR',
  USDT_WALLET:   'USDT Wallet',
  CRYPTO_WALLET: 'Crypto Wallet',
}

const TYPE_CURRENCY: Record<string, string> = {
  BANCO_ARS:     'ARS',
  EFECTIVO_ARS:  'ARS',
  EFECTIVO_USD:  'USD',
  EFECTIVO_EUR:  'EUR',
  USDT_WALLET:   'USDT',
  CRYPTO_WALLET: 'USD',
}

const CURRENCY_SECTIONS = [
  { currency: 'ARS',  label: 'Pesos argentinos',  accent: 'border-l-emerald-500', header: 'text-emerald-400',  badge: 'bg-emerald-900/60 text-emerald-300' },
  { currency: 'USD',  label: 'Dólares',            accent: 'border-l-blue-500',    header: 'text-blue-400',     badge: 'bg-blue-900/60 text-blue-300'       },
  { currency: 'USDT', label: 'USDT',               accent: 'border-l-amber-500',   header: 'text-amber-400',    badge: 'bg-amber-900/60 text-amber-300'     },
  { currency: 'EUR',  label: 'Euros',              accent: 'border-l-violet-500',  header: 'text-violet-400',   badge: 'bg-violet-900/60 text-violet-300'   },
]

const EMPTY_FORM = { name: '', type: 'BANCO_ARS', currency: 'ARS', current_balance: '', owner: 'admin' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}
function fmtBal(n: number, currency: string) {
  if (currency === 'ARS') return fmtARS(n)
  return n.toFixed(2) + ' ' + currency
}
function toARS(amount: number, currency: string, mep: number | null): number | null {
  if (currency === 'ARS') return amount
  if ((currency === 'USD' || currency === 'USDT') && mep) return amount * mep
  return null
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

// ── Componente ────────────────────────────────────────────────────────────────
export default function CuentasDashboard({ initialAccounts, fxMep }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [accounts, setAccounts] = useState<AccountRow[]>(initialAccounts)
  const [loading,  setLoading]  = useState<string | null>(null)

  // Dialog: cuenta
  const [accountOpen, setAccountOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountRow | null>(null)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // Dialog: editar saldo rápido
  const [balOpen,    setBalOpen]    = useState(false)
  const [balAccount, setBalAccount] = useState<AccountRow | null>(null)
  const [newBal,     setNewBal]     = useState('')

  // ── Account CRUD ───────────────────────────────────────────────────────────
  function openNew() {
    setEditAccount(null); setForm(EMPTY_FORM); setAccountOpen(true)
  }

  function openEdit(acc: AccountRow) {
    setEditAccount(acc)
    setForm({ name: acc.name, type: acc.type, currency: acc.currency, current_balance: String(acc.current_balance), owner: acc.owner })
    setAccountOpen(true)
  }

  function openBalance(acc: AccountRow) {
    setBalAccount(acc); setNewBal(String(acc.current_balance)); setBalOpen(true)
  }

  function onTypeChange(type: string) {
    setForm(f => ({ ...f, type, currency: TYPE_CURRENCY[type] ?? 'ARS' }))
  }

  async function saveAccount() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setLoading('account')
    const payload = {
      name:            form.name.trim(),
      type:            form.type,
      currency:        form.currency,
      current_balance: parseFloat(form.current_balance) || 0,
      owner:           form.owner,
    }
    try {
      if (editAccount) {
        const { error } = await db.from('personal_accounts').update(payload).eq('id', editAccount.id)
        if (error) throw error
        setAccounts(prev => prev.map(a => a.id === editAccount.id ? { ...a, ...payload } : a))
        toast.success('Cuenta actualizada')
      } else {
        const { data, error } = await db.from('personal_accounts').insert({ ...payload, is_active: true }).select().single()
        if (error) throw error
        setAccounts(prev => [...prev, data])
        toast.success('Cuenta creada')
      }
      setAccountOpen(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setLoading(null)
    }
  }

  async function saveBalance() {
    if (!balAccount) return
    const balance = parseFloat(newBal)
    if (isNaN(balance)) { toast.error('Saldo inválido'); return }
    setLoading('bal')
    const { error } = await db.from('personal_accounts').update({ current_balance: balance }).eq('id', balAccount.id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setAccounts(prev => prev.map(a => a.id === balAccount.id ? { ...a, current_balance: balance } : a))
    toast.success('Saldo actualizado')
    setLoading(null)
    setBalOpen(false)
  }

  async function deleteAccount(id: string) {
    if (!confirm('¿Eliminar esta cuenta?')) return
    setLoading('del-' + id)
    const { error } = await db.from('personal_accounts').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); setLoading(null); return }
    setAccounts(prev => prev.filter(a => a.id !== id))
    toast.success('Cuenta eliminada')
    setLoading(null)
  }

  // ── Totales ────────────────────────────────────────────────────────────────
  const totalARS = accounts.reduce((sum, a) => {
    const eq = toARS(a.current_balance, a.currency, fxMep)
    return eq != null ? sum + eq : sum
  }, 0)
  const totalUSD = fxMep && fxMep > 0 ? totalARS / fxMep : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}
            {fxMep ? ` · MEP $${Math.round(fxMep).toLocaleString('es-AR')}` : ''}
          </p>
        </div>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
          <Plus className="h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      {/* Sin cuentas */}
      {accounts.length === 0 && (
        <div className="rounded-lg bg-card border border-border flex flex-col items-center justify-center py-20 gap-4">
          <Landmark className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin cuentas. Agregá una para empezar.</p>
          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        </div>
      )}

      {/* Secciones por moneda */}
      {CURRENCY_SECTIONS.map(({ currency, label, accent, header, badge }) => {
        const items = accounts.filter(a => a.currency === currency)
        if (items.length === 0) return null

        const sectionTotal = items.reduce((s, a) => s + a.current_balance, 0)
        const sectionARS   = toARS(sectionTotal, currency, fxMep)

        return (
          <div key={currency} className="space-y-3">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <p className={`text-[11px] font-semibold tracking-[0.12em] uppercase ${header}`}>
                {label}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                Total: {fmtBal(sectionTotal, currency)}
                {sectionARS != null && currency !== 'ARS' && (
                  <span className="text-muted-foreground/50 ml-1">≈ {fmtARS(sectionARS)}</span>
                )}
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map(acc => {
                const arsEq = toARS(acc.current_balance, currency, fxMep)
                return (
                  <div key={acc.id} className={`rounded-lg bg-card border border-border border-l-4 ${accent} p-5 space-y-3`}>
                    {/* Nombre + actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{acc.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge}`}>
                            {TYPE_LABELS[acc.type] ?? acc.type}
                          </span>
                          {acc.owner === 'familia' && (
                            <span className="text-[10px] text-muted-foreground/60">familia</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => openBalance(acc)} title="Editar saldo" className="p-1 text-muted-foreground hover:text-emerald-400 transition-colors">
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => openEdit(acc)} title="Editar cuenta" className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteAccount(acc.id)} disabled={loading === 'del-' + acc.id} title="Eliminar" className="p-1 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Saldo */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Saldo actual</p>
                      <p className="text-xl font-semibold tabular-nums text-foreground">
                        {fmtBal(acc.current_balance, currency)}
                      </p>
                      {arsEq != null && currency !== 'ARS' && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          ≈ {fmtARS(arsEq)} al MEP
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Totales generales */}
      {accounts.length > 0 && (
        <div className="rounded-lg bg-card border border-border p-5">
          <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground mb-3">
            Patrimonio total en efectivo y cuentas
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">Total ARS equivalente</p>
              <p className="text-xl font-semibold tabular-nums text-foreground">{fmtARS(totalARS)}</p>
            </div>
            {totalUSD != null && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Total USD equivalente</p>
                <p className="text-xl font-semibold tabular-nums text-blue-400">{totalUSD.toFixed(2)} USD</p>
              </div>
            )}
          </div>
          {fxMep && <p className="text-[10px] text-muted-foreground/50 mt-2">USD/USDT al MEP ${Math.round(fxMep).toLocaleString('es-AR')}</p>}
        </div>
      )}

      {/* ── Dialog: Cuenta ─────────────────────────────────────────────────── */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editAccount ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); saveAccount() }} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <FormInput label="Nombre *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Cuenta Galicia ARS" required />
              </div>
              <div className="col-span-2">
                <FormSelect label="Tipo" value={form.type} onChange={e => onTypeChange(e.target.value)}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </FormSelect>
              </div>
              <FormSelect label="Moneda" value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['ARS', 'USD', 'USDT', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
              </FormSelect>
              <FormSelect label="Owner" value={form.owner} onChange={e => set('owner', e.target.value)}>
                <option value="admin">admin</option>
                <option value="familia">familia</option>
              </FormSelect>
              <div className="col-span-2">
                <FormInput label="Saldo inicial" type="number" step="0.01" value={form.current_balance} onChange={e => set('current_balance', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAccountOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading === 'account'}>
                {loading === 'account' ? 'Guardando…' : editAccount ? 'Guardar cambios' : 'Crear cuenta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar saldo rápido ──────────────────────────────────── */}
      <Dialog open={balOpen} onOpenChange={setBalOpen}>
        <DialogContent className="bg-card border-border max-w-xs">
          <DialogHeader>
            <DialogTitle>Actualizar saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {balAccount && (
              <p className="text-sm text-muted-foreground">{balAccount.name}</p>
            )}
            <FormInput
              label={`Nuevo saldo (${balAccount?.currency ?? ''})`}
              type="number" step="0.01"
              value={newBal}
              onChange={e => setNewBal(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBalOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveBalance} disabled={loading === 'bal'}>
                {loading === 'bal' ? 'Guardando…' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
