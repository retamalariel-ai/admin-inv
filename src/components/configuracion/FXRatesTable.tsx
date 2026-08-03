'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge }  from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface FXRate {
  rate_date:    string
  rate_mep:     number | null
  rate_ccl:     number | null
  rate_blue:    number | null
  rate_oficial: number | null
  rate_time:    string | null
  source:       string
}

interface Props {
  rates: FXRate[]
}

const SOURCE_BADGE: Record<string, string> = {
  IOL_CALCULADO:  'bg-emerald-900/60 text-emerald-300 border-emerald-700/40',
  PPI_CALCULADO:  'bg-amber-900/60   text-amber-300   border-amber-700/40',
  DOLARAPI:       'bg-blue-900/60    text-blue-300    border-blue-700/40',
  ARGENTINADATOS: 'bg-slate-700/60   text-slate-300   border-slate-600',
  MANUAL:         'bg-orange-900/60  text-orange-300  border-orange-700/40',
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function fmtARS(v: number | null): string {
  if (v == null) return '—'
  const [int, dec] = v.toFixed(2).split('.')
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `$ ${intFmt},${dec}`
}

export default function FXRatesTable({ rates }: Props) {
  const router          = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Un registro por día — el primero ya es el más reciente (order DESC)
  const dailyRates = rates.reduce((acc, rate) => {
    if (!acc.some(r => r.rate_date === rate.rate_date)) acc.push(rate)
    return acc
  }, [] as typeof rates)

  async function callEndpoint(label: string, url: string, body?: object) {
    setBusy(label)
    try {
      const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const data = await res.json() as Record<string, unknown>
      if (res.ok) {
        toast.success(`${label} completado`)
        router.refresh()
      } else {
        toast.error(`Error: ${String(data.error ?? data.detail ?? 'desconocido')}`)
      }
    } catch (e) {
      toast.error(`Error de red: ${String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy}
          onClick={() => callEndpoint('Actualizar FX', '/api/fx-rates/update')}
          className="gap-2 border-slate-600 text-slate-300 hover:text-slate-100"
        >
          {busy === 'Actualizar FX'
            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          Actualizar FX
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!!busy}
          onClick={() => callEndpoint('Historial 90d', '/api/fx-rates/history', { days: 90 })}
          className="gap-2 border-slate-600 text-slate-300 hover:text-slate-100"
        >
          {busy === 'Historial 90d' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          Cargar histórico 90d
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-700 overflow-x-auto">
        <div className="max-h-[640px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-900">
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs">Fecha</TableHead>
                <TableHead className="text-right text-slate-400 text-xs">MEP</TableHead>
                <TableHead className="text-right text-slate-400 text-xs">CCL</TableHead>
                <TableHead className="text-right text-slate-400 text-xs">Blue</TableHead>
                <TableHead className="text-right text-slate-400 text-xs">Oficial</TableHead>
                <TableHead className="text-slate-400 text-xs">Fuente</TableHead>
                <TableHead className="text-slate-400 text-xs">Hora</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyRates.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-10 text-sm">
                    Sin registros. Presioná "Actualizar FX".
                  </TableCell>
                </TableRow>
              )}
              {dailyRates.map((r, i) => {
                const isLatest   = i === 0
                const badgeCls   = SOURCE_BADGE[r.source] ?? 'bg-slate-700/60 text-slate-400 border-slate-600'
                const rowCls     = isLatest
                  ? 'border-l-2 border-l-emerald-500 border-slate-700/60 hover:bg-slate-800/50'
                  : 'border-slate-700/60 hover:bg-slate-800/50'

                return (
                  <TableRow key={`${r.rate_date}-${r.source}-${i}`} className={rowCls}>
                    <TableCell className="tabular-nums text-slate-200 font-medium whitespace-nowrap">
                      {fmtDate(r.rate_date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-100 font-semibold">
                      {fmtARS(r.rate_mep)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-100 font-semibold">
                      {fmtARS(r.rate_ccl)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">
                      {fmtARS(r.rate_blue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-300">
                      {fmtARS(r.rate_oficial)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs border ${badgeCls}`}>{r.source}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-slate-500 text-xs whitespace-nowrap">
                      {r.rate_time?.slice(0, 5) ?? '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-right">
        {dailyRates.length} días
      </p>
    </div>
  )
}
