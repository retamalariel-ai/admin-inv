import { createClient } from '@supabase/supabase-js'
import { calculateRatesFromIOL } from '@/lib/iol/client'
import { calculateRatesFromPPI } from '@/lib/ppi/client'
import type { Database } from '@/types/database.types'

interface DolarApiEntry {
  casa:   string
  compra: number | null
  venta:  number | null
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST() {
  let mep:            number | null = null
  let ccl:            number | null = null
  let oficial:        number | null = null
  let blue:           number | null = null
  let source = 'DOLARAPI'
  let cclTickerArs    = 'AE30'
  let cclTickerUsd    = 'GD30D'

  // ── 1. MEP/CCL desde IOL (precios BYMA oficiales — mayor precisión) ───────
  try {
    const rates = await calculateRatesFromIOL()
    if (rates.mep != null && rates.ccl != null) {
      mep         = rates.mep
      ccl         = rates.ccl
      source      = 'IOL_CALCULADO'
      cclTickerArs = rates.ccl_ticker_ars ?? 'AE30'
      cclTickerUsd = rates.ccl_ticker_usd ?? 'GD30D'
    }
  } catch (e) {
    console.warn('[fx-rates/update] IOL failed, trying PPI:', e)

    // ── 2. Fallback a PPI ─────────────────────────────────────────────────
    try {
      const rates = await calculateRatesFromPPI()
      if (rates.mep != null && rates.ccl != null) {
        mep         = rates.mep
        ccl         = rates.ccl
        source      = 'PPI_CALCULADO'
        cclTickerArs = 'GD30'
        cclTickerUsd = 'GD30D'
      }
    } catch (e2) {
      console.warn('[fx-rates/update] PPI also failed, will use dolarapi for MEP/CCL:', e2)
    }
  }

  // ── 3. Oficial/Blue siempre desde dolarapi (IOL y PPI no los proveen) ────
  // Si ninguno de los anteriores dio MEP/CCL, también los tomamos de acá.
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares', {
      next:    { revalidate: 0 },
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`dolarapi ${res.status}`)

    const dolares = await res.json() as DolarApiEntry[]
    const findVenta = (casa: string) =>
      dolares.find(d => d.casa.toLowerCase() === casa.toLowerCase())?.venta ?? null

    oficial = findVenta('oficial')
    blue    = findVenta('blue')

    if (mep == null) { mep = findVenta('bolsa');           source = 'DOLARAPI' }
    if (ccl == null) { ccl = findVenta('contadoconliqui'); source = 'DOLARAPI' }
  } catch (e) {
    console.warn('[fx-rates/update] dolarapi also failed:', e)
  }

  // ── 4. INSERT en fx_rates ─────────────────────────────────────────────────
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8)

  const supabase = getServiceClient()

  const { error } = await supabase.from('fx_rates').insert({
    rate_date:      date,
    rate_time:      time,
    rate_mep:       mep,
    rate_ccl:       ccl,
    rate_oficial:   oficial,
    rate_blue:      blue,
    mep_ticker_ars: 'AL30',
    mep_ticker_usd: 'AL30D',
    ccl_ticker_ars: cclTickerArs,
    ccl_ticker_usd: cclTickerUsd,
    source,
  })

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  return Response.json({
    success:   true,
    source,
    mep,
    ccl,
    oficial,
    blue,
    timestamp: `${date}T${time}`,
  })
}
