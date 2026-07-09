'use client'

import Link from 'next/link'
import { Landmark } from 'lucide-react'
import Decimal from 'decimal.js'

export interface PFAccount {
  id: string
  name: string
  type: string
  currency: string
  current_balance: number
  owner: string
}

interface Props {
  accounts: PFAccount[]
  fxMep: number | null
}

const CURRENCY_LABELS: Record<string, string> = {
  ARS:  'Pesos',
  USD:  'Dólares',
  USDT: 'USDT',
  EUR:  'Euros',
}

const CURRENCY_COLOR: Record<string, string> = {
  ARS:  'text-emerald-400',
  USD:  'text-blue-400',
  USDT: 'text-teal-400',
  EUR:  'text-amber-400',
}

function fmtARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function SaldosCard({ accounts, fxMep }: Props) {
  const byCurrency = accounts.reduce<Record<string, Decimal>>((acc, a) => {
    acc[a.currency] = (acc[a.currency] ?? new Decimal(0)).plus(a.current_balance)
    return acc
  }, {})

  const mep = fxMep ?? 0

  const totalARS = Object.entries(byCurrency).reduce((sum, [cur, bal]) => {
    if (cur === 'ARS')  return sum.plus(bal)
    if ((cur === 'USD' || cur === 'USDT') && mep > 0) return sum.plus(bal.mul(mep))
    return sum
  }, new Decimal(0))

  const ordered = ['ARS', 'USD', 'USDT', 'EUR'].filter(c => byCurrency[c] != null)

  if (accounts.length === 0) {
    return (
      <div className="rounded-lg bg-card border border-border p-5 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <Landmark className="h-7 w-7 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground text-center">Sin cuentas registradas</p>
        <Link href="/finanzas-personales/cuentas" className="text-xs text-primary underline-offset-2 hover:underline">
          Agregar una cuenta
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-card border border-border p-5 space-y-4">
      <p className="text-[10px] font-semibold tracking-[0.13em] uppercase text-muted-foreground">
        Saldos por moneda
      </p>

      <div className="grid grid-cols-2 gap-3">
        {ordered.map(cur => {
          const bal = byCurrency[cur]!
          return (
            <div key={cur} className="rounded-md bg-muted/30 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">{CURRENCY_LABELS[cur] ?? cur}</p>
              <p className={`text-sm font-semibold tabular-nums ${CURRENCY_COLOR[cur] ?? 'text-foreground'}`}>
                {cur === 'ARS'
                  ? fmtARS(bal.toNumber())
                  : bal.toFixed(2) + ' ' + cur}
              </p>
            </div>
          )
        })}
      </div>

      {mep > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Total equivalente ARS</p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {fmtARS(totalARS.toNumber())}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            USD/USDT al MEP ${mep.toFixed(0)}
          </p>
        </div>
      )}
    </div>
  )
}
