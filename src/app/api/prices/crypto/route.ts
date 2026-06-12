import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

function getServiceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET /api/prices/crypto?ids=bitcoin,ethereum ────────────────────────────
export const revalidate = 300

export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  if (!ids) {
    return NextResponse.json({ error: 'ids param required' }, { status: 400 })
  }

  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

// ── POST /api/prices/crypto — batch update from DB assets ─────────────────
export async function POST() {
  // Service role para bypass RLS en llamadas sin sesión
  const supabase = getServiceClient()

  const { data: assets, error: assetErr } = await supabase
    .from('assets')
    .select('id, ticker, coingecko_id, currency')
    .eq('is_active', true)
    .eq('data_source', 'COINGECKO')
    .not('coingecko_id', 'is', null)

  if (assetErr || !assets || assets.length === 0) {
    return NextResponse.json({ success: true, updated: 0, note: 'No crypto assets found' })
  }

  const ids = assets.map(a => a.coingecko_id).join(',')

  let prices: Record<string, { usd: number }>
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
    prices = await res.json()
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 502 })
  }

  const svc = getServiceClient()
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8)

  const inserts = assets
    .filter(a => a.coingecko_id && prices[a.coingecko_id]?.usd != null)
    .map(a => ({
      asset_id:   a.id,
      quote_date: date,
      quote_time: time,
      price:      prices[a.coingecko_id!]!.usd,
      currency:   'USD_MEP' as const,
      source:     'COINGECKO',
    }))

  if (inserts.length === 0) {
    return NextResponse.json({ success: true, updated: 0, note: 'No prices from CoinGecko' })
  }

  const { error } = await svc.from('price_quotes').upsert(inserts, {
    onConflict: 'asset_id,quote_date,source',
    ignoreDuplicates: false,
  })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    updated: inserts.length,
    prices:  Object.fromEntries(inserts.map(i => [i.asset_id, i.price])),
  })
}
