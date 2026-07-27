'use client'

import { useState, useMemo } from 'react'
import Decimal from 'decimal.js'
import { toast } from 'sonner'
import { Pencil, Check, X, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { formatUSD, formatCrypto } from '@/lib/utils/calculations'
import TransactionDialog from '@/components/transactions/TransactionDialog'

// Shape returned by the server query in crypto/page.tsx
export interface EarnPosition {
  id:               string
  asset_id:         string
  portfolio_id:     string
  principal_amount: number
  apy_pct:          number
  platform:         string | null
  currency:         string
  start_date:       string
  notes:            string | null
  assets:           { ticker: string; name: string } | null
  portfolios:       { name: string; custodian_name: string | null } | null
  principal_amount_usd?: number
}

interface Props {
  earnPositions: EarnPosition[]
}

function daysAccrued(startDate: string): number {
  const start = new Date(startDate).getTime()
  const now   = Date.now()
  return Math.max(0, Math.floor((now - start) / 86_400_000))
}

const TIER_LABEL: Record<string, string> = {
  NEXO_GOLD:     'Nexo Gold',
  NEXO_SILVER:   'Nexo Silver',
  NEXO_PLATINUM: 'Nexo Platinum',
  BINANCE_EARN:  'Binance Earn',
  OTRA:          'Otra',
}

// ── Inline editor for principal + APY ────────────────────────────────────────
interface EditState {
  principal: string
  apy:       string
}

function EditRow({
  pos,
  onSave,
  onCancel,
}: {
  pos:      EarnPosition
  onSave:   (principal: number, apy: number) => void
  onCancel: () => void
}) {
  const [vals, setVals] = useState<EditState>({
    principal: String(pos.principal_amount),
    apy:       String(pos.apy_pct),
  })

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Capital</span>
        <Input
          value={vals.principal}
          onChange={e => setVals(v => ({ ...v, principal: e.target.value }))}
          className="h-7 w-32 bg-slate-700 border-slate-600 text-slate-100 text-xs"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">APY %</span>
        <Input
          value={vals.apy}
          onChange={e => setVals(v => ({ ...v, apy: e.target.value }))}
          className="h-7 w-20 bg-slate-700 border-slate-600 text-slate-100 text-xs"
        />
      </div>
      <div className="flex gap-1 mt-4">
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300"
          onClick={() => onSave(parseFloat(vals.principal), parseFloat(vals.apy))}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300"
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EarnTracker({ earnPositions }: Props) {
  const [positions, setPositions] = useState<EarnPosition[]>(earnPositions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [registerPos, setRegisterPos] = useState<EarnPosition | null>(null)
  const [txOpen, setTxOpen] = useState(false)

  // Totals
  const totalDailyUSD = useMemo(() =>
    positions.reduce((s, p) => {
      const daily = new Decimal(p.principal_amount).mul(p.apy_pct).div(100).div(365)
      return s.plus(daily)
    }, new Decimal(0)),
    [positions],
  )

  const totalAccruedUSD = useMemo(() =>
    positions.reduce((s, p) => {
      const daily   = new Decimal(p.principal_amount).mul(p.apy_pct).div(100).div(365)
      const accrued = daily.mul(daysAccrued(p.start_date))
      return s.plus(accrued)
    }, new Decimal(0)),
    [positions],
  )

  async function handleUpdateCapital(id: string, principal: number, apy: number) {
    if (isNaN(principal) || isNaN(apy) || principal <= 0 || apy <= 0) {
      toast.error('Capital y APY deben ser números positivos')
      return
    }
    const res = await fetch(`/api/earn-positions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ principal_amount: principal, apy_pct: apy }),
    })
    if (!res.ok) {
      toast.error('Error al actualizar')
      return
    }
    setPositions(prev =>
      prev.map(p => p.id === id ? { ...p, principal_amount: principal, apy_pct: apy } : p),
    )
    setEditingId(null)
    toast.success('Capital actualizado')
  }

  async function handleResetStartDate(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/earn-positions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: today }),
    })
    if (!res.ok) { toast.error('Error al resetear contador'); return }
    setPositions(prev =>
      prev.map(p => p.id === id ? { ...p, start_date: today } : p),
    )
    toast.success('Contador reseteado a hoy')
  }

  async function handleDeactivate(id: string) {
    const res = await fetch(`/api/earn-positions/${id}`, { method: 'PATCH' })
    if (!res.ok) { toast.error('Error al desactivar'); return }
    setPositions(prev => prev.filter(p => p.id !== id))
    toast.success('Posición desactivada')
  }

  function handleRegister(pos: EarnPosition) {
    setRegisterPos(pos)
    setTxOpen(true)
  }

  if (positions.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8 text-sm">
        Sin posiciones Earn configuradas.{' '}
        <span className="text-slate-400">Usá el botón "+ Earn" para agregar una.</span>
      </div>
    )
  }

  // Accrued interest for the register modal quantity (daily × days)
  const registerDaily = registerPos
    ? new Decimal(registerPos.principal_amount).mul(registerPos.apy_pct).div(100).div(365)
    : new Decimal(0)
  const registerDays = registerPos ? daysAccrued(registerPos.start_date) : 0
  const registerQty  = registerDaily.mul(registerDays)

  return (
    <div className="space-y-3">
      {/* Totales */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/40 p-4">
          <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-1">Interés diario proyectado</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-300">
            {formatUSD(totalDailyUSD)} / día
          </p>
        </div>
        <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Acumulado proyectado</p>
          <p className="text-xl font-semibold tabular-nums text-slate-100">
            {formatUSD(totalAccruedUSD)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">desde start_date de cada posición</p>
        </div>
      </div>

      {/* Tarjetas por posición */}
      <div className="space-y-2">
        {positions.map(pos => {
          const daily   = new Decimal(pos.principal_amount).mul(pos.apy_pct).div(100).div(365)
          const days    = daysAccrued(pos.start_date)
          const accrued = daily.mul(days)
          const tierLabel = pos.platform ? (TIER_LABEL[pos.platform] ?? pos.platform) : '—'
          const isEditing = editingId === pos.id

          return (
            <div
              key={pos.id}
              className="rounded-xl bg-slate-800/70 border border-slate-700 p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-emerald-400 text-lg">
                    {pos.assets?.ticker ?? '—'}
                  </span>
                  <div>
                    <p className="text-slate-300 text-sm">{pos.assets?.name ?? ''}</p>
                    <p className="text-xs text-slate-500">
                      {tierLabel} · {pos.portfolios?.custodian_name ?? pos.portfolios?.name ?? ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isEditing && (
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-slate-200"
                      onClick={() => setEditingId(pos.id)}
                    >
                      <Pencil className="h-3 w-3 mr-1" /> Editar
                    </Button>
                  )}
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-slate-600 hover:text-red-400"
                    onClick={() => handleDeactivate(pos.id)}
                    title="Desactivar posición earn"
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Edit inline */}
              {isEditing && (
                <EditRow
                  pos={pos}
                  onSave={(p, a) => handleUpdateCapital(pos.id, p, a)}
                  onCancel={() => setEditingId(null)}
                />
              )}

              {/* Metrics */}
              {!isEditing && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Capital</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-200">
                      {formatCrypto(new Decimal(pos.principal_amount))} {pos.assets?.ticker ?? pos.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">APY</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-400">
                      {Number(pos.apy_pct).toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                      Diario proyectado
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-300">
                      {formatCrypto(daily)} {pos.assets?.ticker ?? pos.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                      Acumulado ({days}d)
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-slate-100">
                      {formatCrypto(accrued)} {pos.assets?.ticker ?? pos.currency}
                    </p>
                  </div>
                </div>
              )}

              {/* Acciones */}
              {!isEditing && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-7 px-3"
                      onClick={() => handleRegister(pos)}
                    >
                      Registrar interés
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-xs h-7 px-3 border-slate-600 text-slate-400 hover:text-slate-200"
                      onClick={() => setEditingId(pos.id)}
                    >
                      Actualizar capital
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Registra los intereses acumulados como transacción en el historial
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de registro rápido */}
      {registerPos && (
        <TransactionDialog
          open={txOpen}
          onOpenChange={open => {
            setTxOpen(open)
            if (!open) setRegisterPos(null)
          }}
          portfolioId={registerPos.portfolio_id}
          defaultAssetId={registerPos.asset_id}
          defaultAssetTicker={registerPos.assets?.ticker}
          prefill={{
            custodian_name:   null,
            transaction_type: 'INTERES_EARN',
            trade_date:       new Date().toISOString().slice(0, 10),
            settlement_date:  null,
            ticker:           registerPos.assets?.ticker ?? null,
            asset_name:       registerPos.assets?.name ?? null,
            asset_type_hint:  'CRYPTO_EARN',
            quantity:         registerQty.toNumber(),
            price_per_unit:   0,
            gross_amount:     null,
            alyce_commission: 0,
            other_fees:       0,
            net_amount:       null,
            currency:         registerPos.currency,
            comitente:        null,
            operation_number: null,
            notes:            [
              'periodo:DIARIO',
              `apy:${Number(registerPos.apy_pct).toFixed(2)}`,
              registerPos.platform ? `tier:${registerPos.platform}` : null,
              `dias:${registerDays}`,
              `diario:${registerDaily.toFixed(8)}`,
            ].filter(Boolean).join('|') + '|',
          }}
          onSuccess={() => {
            toast.success('Interés earn registrado')
            const posId = registerPos?.id
            if (posId) {
              setTimeout(() => {
                toast('¿Resetear el contador de acumulado?', {
                  description: 'Establece start_date a hoy para reiniciar el cálculo desde cero.',
                  action: {
                    label: 'Resetear',
                    onClick: () => handleResetStartDate(posId),
                  },
                  duration: 8000,
                })
              }, 600)
            }
          }}
        />
      )}
    </div>
  )
}
