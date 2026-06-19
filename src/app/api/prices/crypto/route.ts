import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
const BINANCE_BASE   = 'https://api.binance.com/api/v3'

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
  const svc  = getServiceClient()
  const now  = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8)

  let coingeckoUpdated = 0
  let binanceUpdated   = 0
  const errors: string[] = []

  // ── CoinGecko block ────────────────────────────────────────────────────────
  const { data: cgAssets, error: cgAssetErr } = await svc
    .from('assets')
    .select('id, ticker, coingecko_id, currency')
    .eq('is_active', true)
    .eq('data_source', 'COINGECKO')
    .not('coingecko_id', 'is', null)

  console.log('[prices/crypto] CoinGecko assets:', cgAssets?.map(a => a.ticker), 'err:', cgAssetErr?.message)

  if (cgAssets && cgAssets.length > 0) {
    try {
      const ids = cgAssets.map(a => a.coingecko_id).join(',')
      const url = `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
      const prices: Record<string, { usd: number }> = await res.json()

      const inserts = cgAssets
        .filter(a => a.coingecko_id && prices[a.coingecko_id]?.usd != null)
        .map(a => ({
          asset_id:   a.id,
          quote_date: date,
          quote_time: time,
          price:      prices[a.coingecko_id!]!.usd,
          currency:   'USD_MEP' as const,
          source:     'COINGECKO',
        }))

      if (inserts.length > 0) {
        const { error: upsertErr } = await svc.from('price_quotes').upsert(inserts, {
          onConflict: 'asset_id,quote_date,source',
          ignoreDuplicates: false,
        })
        if (upsertErr) errors.push(`CoinGecko upsert: ${upsertErr.message}`)
        else coingeckoUpdated = inserts.length
      }
      console.log('[prices/crypto] CoinGecko updated:', coingeckoUpdated)
    } catch (err) {
      console.error('[prices/crypto] CoinGecko error:', String(err))
      errors.push(`CoinGecko fetch: ${String(err)}`)
    }
  }

  // ── Binance block ──────────────────────────────────────────────────────────
  const { data: bnAssets, error: bnAssetErr } = await svc
    .from('assets')
    .select('id, ticker')
    .eq('is_active', true)
    .eq('data_source', 'BINANCE')

  console.log('[prices/crypto] Binance assets:', bnAssets?.map(a => a.ticker), 'err:', bnAssetErr?.message)

  if (bnAssets && bnAssets.length > 0) {
    try {
      const symbols = JSON.stringify(bnAssets.map(a => a.ticker.toUpperCase() + 'USDT'))
      const url = `${BINANCE_BASE}/ticker/price?symbols=${encodeURIComponent(symbols)}`
      console.log('[prices/crypto] Binance URL:', url)
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Binance ticker ${res.status}: ${body}`)
      }
      const ticker: { symbol: string; price: string }[] = await res.json()

      const priceMap = new Map(ticker.map(t => [t.symbol.replace(/USDT$/, ''), parseFloat(t.price)]))

      const inserts = bnAssets
        .filter(a => priceMap.has(a.ticker.toUpperCase()))
        .map(a => ({
          asset_id:   a.id,
          quote_date: date,
          quote_time: time,
          price:      priceMap.get(a.ticker.toUpperCase())!,
          currency:   'USD_MEP' as const,
          source:     'BINANCE',
        }))

      if (inserts.length > 0) {
        const { error: upsertErr } = await svc.from('price_quotes').upsert(inserts, {
          onConflict: 'asset_id,quote_date,source',
          ignoreDuplicates: false,
        })
        if (upsertErr) errors.push(`Binance upsert: ${upsertErr.message}`)
        else binanceUpdated = inserts.length
      }
      console.log('[prices/crypto] Binance updated:', binanceUpdated)
    } catch (err) {
      console.error('[prices/crypto] Binance error:', String(err))
      errors.push(`Binance fetch: ${String(err)}`)
    }
  }

  return NextResponse.json({
    success:   errors.length === 0,
    coingecko: coingeckoUpdated,
    binance:   binanceUpdated,
    ...(errors.length > 0 ? { errors } : {}),
  })
}
