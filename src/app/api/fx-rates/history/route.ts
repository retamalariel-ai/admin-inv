// Loads historical FX rates from:
//   CCL/MEP: https://api.argentinadatos.com/v1/cotizaciones/dolares/{contadoconliqui|bolsa}
//   Blue/Oficial: https://api.bluelytics.com.ar/v2/evolution.json
// Inserts one record per day (skips dates that already have any record).

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ArgenEntry {
  casa:   string
  compra: number | null
  venta:  number | null
  fecha:  string   // YYYY-MM-DD
}

interface BluelyticsEntry {
  date:       string   // YYYY-MM-DD
  source:     string   // "Blue" | "Oficial"
  value_sell: number
  value_buy:  number
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { days?: number }
    const days = Math.min(Math.max(Number(body.days ?? 90), 1), 730)

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().slice(0, 10)

    // ── Fetch from all sources in parallel ────────────────────────────────────
    const [cclRes, mepRes, bluelyticsRes] = await Promise.all([
      fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui', {
        next: { revalidate: 0 },
      }),
      fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa', {
        next: { revalidate: 0 },
      }),
      fetch('https://api.bluelytics.com.ar/v2/evolution.json', {
        next: { revalidate: 0 },
      }),
    ])

    if (!cclRes.ok) throw new Error(`argentinadatos CCL: HTTP ${cclRes.status}`)
    if (!mepRes.ok) throw new Error(`argentinadatos MEP: HTTP ${mepRes.status}`)
    if (!bluelyticsRes.ok) throw new Error(`bluelytics: HTTP ${bluelyticsRes.status}`)

    const cclData     = (await cclRes.json())      as ArgenEntry[]
    const mepData     = (await mepRes.json())       as ArgenEntry[]
    const bluelytics  = (await bluelyticsRes.json()) as BluelyticsEntry[]

    // ── Build date → rate maps (filter to requested range) ───────────────────
    const cclByDate:     Map<string, number> = new Map()
    const mepByDate:     Map<string, number> = new Map()
    const blueByDate:    Map<string, number> = new Map()
    const oficialByDate: Map<string, number> = new Map()

    for (const e of cclData) {
      if (e.fecha >= startStr) cclByDate.set(e.fecha, e.venta ?? e.compra ?? 0)
    }
    for (const e of mepData) {
      if (e.fecha >= startStr) mepByDate.set(e.fecha, e.venta ?? e.compra ?? 0)
    }
    for (const e of bluelytics) {
      if (e.date < startStr) continue
      if (e.source === 'Blue')   blueByDate.set(e.date, e.value_sell)
      if (e.source === 'Oficial') oficialByDate.set(e.date, e.value_sell)
    }

    // ── Union of all dates found ───────────────────────────────────────────────
    const allDates = Array.from(new Set([
      ...cclByDate.keys(),
      ...mepByDate.keys(),
      ...blueByDate.keys(),
      ...oficialByDate.keys(),
    ])).sort()

    if (allDates.length === 0) {
      return Response.json({ success: true, daysProcessed: 0, message: 'Sin datos en el rango' })
    }

    // ── Skip dates that already have any record ───────────────────────────────
    const supabase = serviceClient()
    const { data: existing, error: existErr } = await supabase
      .from('fx_rates')
      .select('rate_date')
      .gte('rate_date', startStr)

    if (existErr) throw new Error(`DB check: ${existErr.message}`)

    const existingDates = new Set((existing ?? []).map(r => r.rate_date))

    const rows = allDates
      .filter(date => !existingDates.has(date))
      .map(date => ({
        rate_date:      date,
        rate_time:      '00:00:00',
        rate_ccl:       cclByDate.get(date)     ?? null,
        rate_mep:       mepByDate.get(date)     ?? null,
        rate_blue:      blueByDate.get(date)    ?? null,
        rate_oficial:   oficialByDate.get(date) ?? null,
        mep_ticker_ars: 'AL30',
        mep_ticker_usd: 'AL30D',
        ccl_ticker_ars: 'AE30',
        ccl_ticker_usd: 'GD30D',
        source:         'ARGENTINADATOS',
      }))

    if (rows.length === 0) {
      return Response.json({
        success:       true,
        daysProcessed: 0,
        message:       `Todos los días ya están cargados (${existingDates.size} registros existentes)`,
      })
    }

    // ── Insert in batches of 100 ──────────────────────────────────────────────
    const BATCH = 100
    let inserted = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from('fx_rates').insert(rows.slice(i, i + BATCH))
      if (error) throw new Error(`Insert batch ${i / BATCH + 1}: ${error.message}`)
      inserted += Math.min(BATCH, rows.length - i)
    }

    return Response.json({
      success:       true,
      daysProcessed: inserted,
      skipped:       existingDates.size,
      range:         { from: rows[0]?.rate_date, to: rows.at(-1)?.rate_date },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[fx-rates/history] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
