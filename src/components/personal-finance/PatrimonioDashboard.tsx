'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type PortfolioRow = {
  id: string
  name: string
  custodian_name: string | null
  clients: { full_name: string } | null
}

export type AccountRow = {
  id: string
  name: string
  type: string
  currency: string
  current_balance: number
}

export type InstRow = {
  id: string
  installment_amount: number
  currency: string
  total_installments: number
  paid_installments: number
  is_active: boolean
  personal_cards: { name: string } | null
}

interface Props {
  portfolios:    PortfolioRow[]
  aumByPortfolio: Record<string, { ars: number; usd: number }>
  initialOwnerships: Record<string, { pct: number; include: boolean }>
  accounts:      AccountRow[]
  installments:  InstRow[]
  fxMep:         number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n)
}

function fmtUSD(n: number) {
  return 'US$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function toARS(amount: number, currency: string, mep: number | null): number {
  if (currency === 'ARS') return amount
  if ((currency === 'USD' || currency === 'USDT') && mep) return amount * mep
  return 0
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-3">
      {children}
    </p>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ${checked ? 'bg-emerald-600' : 'bg-muted/50'}`}
      style={{ height: '18px', width: '34px' }}
    >
      <span
        className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[17px]' : 'translate-x-0.5'}`}
      />
    </button>
  )
}

// ── Componente ─────────────────────────────────────────────────────────────────
export default function PatrimonioDashboard({
  portfolios, aumByPortfolio, initialOwnerships, accounts, installments, fxMep,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any

  const [ownerships, setOwnerships] = useState<Record<string, { pct: number; include: boolean }>>(
    () => {
      const map: Record<string, { pct: number; include: boolean }> = {}
      for (const p of portfolios) {
        map[p.id] = initialOwnerships[p.id] ?? { pct: 100, include: true }
      }
      return map
    }
  )
  const [displayCurrency, setDisplayCurrency] = useState<'ARS' | 'USD'>('ARS')
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Debounce upsert ────────────────────────────────────────────────────────
  async function upsertOwnership(portfolioId: string, pct: number, include: boolean) {
    const { error } = await db.from('personal_portfolio_ownership').upsert(
      { portfolio_id: portfolioId, ownership_pct: pct, include_in_patrimony: include, updated_at: new Date().toISOString() },
      { onConflict: 'portfolio_id' }
    )
    if (error) toast.error(error.message)
  }

  function updatePct(portfolioId: string, pct: number) {
    const include = ownerships[portfolioId]?.include ?? true
    setOwnerships(prev => ({ ...prev, [portfolioId]: { pct, include } }))
    clearTimeout(timers.current[portfolioId])
    timers.current[portfolioId] = setTimeout(() => upsertOwnership(portfolioId, pct, include), 500)
  }

  function updateInclude(portfolioId: string) {
    const prev    = ownerships[portfolioId] ?? { pct: 100, include: true }
    const include = !prev.include
    setOwnerships(o => ({ ...o, [portfolioId]: { ...prev, include } }))
    clearTimeout(timers.current[portfolioId])
    timers.current[portfolioId] = setTimeout(() => upsertOwnership(portfolioId, prev.pct, include), 500)
  }

  // ── Cálculos ───────────────────────────────────────────────────────────────
  let totalFinancieroARS = 0
  for (const p of portfolios) {
    const own = ownerships[p.id]
    if (!own?.include) continue
    totalFinancieroARS += (aumByPortfolio[p.id]?.ars ?? 0) * own.pct / 100
  }

  const totalEfectivoARS = accounts.reduce((sum, a) => sum + toARS(a.current_balance, a.currency, fxMep), 0)

  const debtByCard: Record<string, number> = {}
  let totalPasivosARS = 0
  for (const inst of installments) {
    if (!inst.is_active) continue
    const remaining = inst.total_installments - inst.paid_installments
    if (remaining <= 0) continue
    const debtARS = toARS(inst.installment_amount * remaining, inst.currency, fxMep)
    totalPasivosARS += debtARS
    const cardName = inst.personal_cards?.name ?? 'Sin tarjeta'
    debtByCard[cardName] = (debtByCard[cardName] ?? 0) + debtARS
  }

  const patrimonioNetoARS = totalFinancieroARS + totalEfectivoARS - totalPasivosARS
  const patrimonioNetoUSD = fxMep && fxMep > 0 ? patrimonioNetoARS / fxMep : null

  function display(ars: number): string {
    if (displayCurrency === 'USD' && fxMep && fxMep > 0) return fmtUSD(ars / fxMep)
    return fmtARS(ars)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Patrimonio Neto</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Activos, efectivo y pasivos personales</p>
        </div>
        {/* Toggle moneda */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border text-xs">
          {(['ARS', 'USD'] as const).map(cur => (
            <button
              key={cur}
              onClick={() => setDisplayCurrency(cur)}
              disabled={cur === 'USD' && !fxMep}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors disabled:opacity-30 ${
                displayCurrency === cur ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>
      </div>

      {/* ── Resumen sticky ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 rounded-lg bg-card border border-border p-5 shadow-md space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Activos financieros</p>
            <p className="font-semibold tabular-nums text-foreground">{display(totalFinancieroARS)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-0.5">Efectivo y cuentas</p>
            <p className="font-semibold tabular-nums text-foreground">{display(totalEfectivoARS)}</p>
          </div>
          <div>
            <p className="text-[10px] text-red-400/80 mb-0.5">Pasivos</p>
            <p className="font-semibold tabular-nums text-red-400">{display(totalPasivosARS)}</p>
          </div>
        </div>
        <div className="border-t border-border pt-3 flex items-baseline justify-between">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Patrimonio neto</p>
          <div className="text-right">
            <p className={`text-2xl font-bold tabular-nums ${patrimonioNetoARS >= 0 ? 'text-foreground' : 'text-red-400'}`}>
              {display(patrimonioNetoARS)}
            </p>
            {displayCurrency === 'ARS' && patrimonioNetoUSD != null && (
              <p className="text-xs text-muted-foreground/60 mt-0.5 tabular-nums">{fmtUSD(patrimonioNetoUSD)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1: Activos Financieros ─────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader>1 · Activos financieros — portfolios CFO Inversiones</SectionHeader>

        {portfolios.length === 0 ? (
          <div className="rounded-lg bg-card border border-border px-5 py-8 text-sm text-muted-foreground text-center">
            Sin portfolios activos en el sistema
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
            {portfolios.map(p => {
              const own = ownerships[p.id] ?? { pct: 100, include: true }
              const aum = aumByPortfolio[p.id] ?? { ars: 0, usd: 0 }
              const myPartARS = aum.ars * own.pct / 100

              return (
                <div key={p.id} className={`px-5 py-4 space-y-3 transition-opacity ${!own.include ? 'opacity-40' : ''}`}>
                  {/* Nombre + toggle */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.clients?.full_name ?? ''}
                        {p.custodian_name ? ` · ${p.custodian_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-muted-foreground">Incluir</span>
                      <Toggle checked={own.include} onChange={() => updateInclude(p.id)} />
                    </div>
                  </div>

                  {/* AUM + slider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground tabular-nums">{display(aum.ars)}</span>
                        <span className="text-muted-foreground/50 tabular-nums">
                          {displayCurrency === 'ARS' && aum.usd > 0 && `≈ ${fmtUSD(aum.usd)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0} max={100} step={1}
                          value={own.pct}
                          disabled={!own.include}
                          onChange={e => updatePct(p.id, Number(e.target.value))}
                          className="flex-1 h-1.5 rounded-full cursor-pointer accent-emerald-500 disabled:cursor-not-allowed"
                        />
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min={0} max={100}
                            value={own.pct}
                            disabled={!own.include}
                            onChange={e => updatePct(p.id, Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="w-12 bg-muted/30 border border-border rounded px-1.5 py-0.5 text-xs text-right text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mi parte */}
                  {own.include && own.pct < 100 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Mi parte ({own.pct}%)</span>
                      <span className="font-semibold tabular-nums text-emerald-400">{display(myPartARS)}</span>
                    </div>
                  )}
                  {own.include && own.pct === 100 && (
                    <div className="flex justify-end">
                      <span className="text-xs font-semibold tabular-nums text-emerald-400">{display(myPartARS)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECCIÓN 2: Efectivo y Cuentas ──────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader>2 · Efectivo y cuentas</SectionHeader>

        {accounts.length === 0 ? (
          <div className="rounded-lg bg-card border border-border px-5 py-8 text-sm text-muted-foreground text-center">
            Sin cuentas registradas
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
            {accounts.map(acc => {
              const arsEq = toARS(acc.current_balance, acc.currency, fxMep)
              const balLabel = acc.currency === 'ARS'
                ? fmtARS(acc.current_balance)
                : `${acc.current_balance.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${acc.currency}`

              return (
                <div key={acc.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{acc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{acc.type.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm tabular-nums font-medium text-foreground">{balLabel}</p>
                    {acc.currency !== 'ARS' && (
                      <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                        {display(arsEq)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="px-5 py-3 flex items-center justify-between bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total efectivo</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{display(totalEfectivoARS)}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── SECCIÓN 3: Pasivos ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionHeader>3 · Pasivos — cuotas pendientes</SectionHeader>

        {Object.keys(debtByCard).length === 0 ? (
          <div className="rounded-lg bg-card border border-border px-5 py-8 text-sm text-muted-foreground text-center">
            Sin pasivos registrados
          </div>
        ) : (
          <div className="rounded-lg bg-card border border-border divide-y divide-border overflow-hidden">
            {Object.entries(debtByCard).map(([cardName, debtARS]) => (
              <div key={cardName} className="px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-foreground">{cardName}</p>
                <p className="text-sm tabular-nums font-medium text-red-400">{display(debtARS)}</p>
              </div>
            ))}
            <div className="px-5 py-3 flex items-center justify-between bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total pasivos</p>
              <p className="text-sm font-semibold tabular-nums text-red-400">{display(totalPasivosARS)}</p>
            </div>
          </div>
        )}
      </div>

      {fxMep && (
        <p className="text-[10px] text-muted-foreground/40 text-right">
          MEP ${Math.round(fxMep).toLocaleString('es-AR')} · USD y USDT convertidos al MEP
        </p>
      )}
    </div>
  )
}
