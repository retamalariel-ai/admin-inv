import { createClient } from '@supabase/supabase-js'
import {
  getIOLQuotes,
  calculateRatesFromIOL,
} from '@/lib/iol/client'
import { toIOLTicker } from '@/lib/iol/tickers'
import {
  getPPIQuotes,
  calculateRatesFromPPI,
  assetTypeToPPI,
  getPPIQuote,
} from '@/lib/ppi/client'
import type { Database } from '@/types/database.types'

type AssetType = Database['public']['Enums']['asset_type']
type Currency  = Database['public']['Enums']['currency']

const EXCLUDED_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_ARS', 'CASH_USD_MEP', 'CASH_USD_CCL',
  'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE',
]

const BOND_TYPES: AssetType[] = [
  'BONO_SOBERANO', 'BONO_SUBSOBERANO', 'ON', 'LETES', 'LECAP',
]

function isBond(assetType: AssetType): boolean {
  return BOND_TYPES.includes(assetType)
}

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function priceCurrency(ticker: string, assetType: AssetType): Currency {
  if (
    ticker.endsWith('D') &&
    (assetType === 'BONO_SOBERANO' || assetType === 'BONO_SUBSOBERANO')
  ) {
    return 'USD_CCL'
  }
  return 'ARS'
}

type AssetRow = { id: string; ticker: string; asset_type: string; currency: string }
type DB       = ReturnType<typeof getServiceClient>

// ── POST — actualiza todos los precios TradFi ──────────────────────────────
// Fuente primaria: IOL API (precios BYMA oficiales)
// Fallback:        PPI API
export async function POST() {
  const supabase = getServiceClient()

  const { data: assets, error: assetErr } = await supabase
    .from('assets')
    .select('id, ticker, asset_type, currency')
    .eq('is_active', true)
    .not('asset_type', 'in', `(${EXCLUDED_TYPES.join(',')})`)

  if (assetErr || !assets?.length) {
    return Response.json(
      { success: false, error: assetErr?.message ?? 'No assets found' },
      { status: 404 },
    )
  }

  const now       = new Date()
  const quoteDate = now.toISOString().slice(0, 10)
  const quoteTime = now.toTimeString().slice(0, 8)

  // Fuente primaria: IOL
  try {
    const result = await fetchFromIOL(assets, supabase, quoteDate, quoteTime)
    return Response.json(result)
  } catch (e) {
    console.warn('[tradfi] IOL failed, falling back to PPI:', e)
  }

  // Fallback: PPI
  try {
    const result = await fetchFromPPI(assets, supabase, quoteDate, quoteTime)
    return Response.json(result)
  } catch (e) {
    return Response.json(
      { success: false, error: 'Both IOL and PPI failed', detail: String(e) },
      { status: 503 },
    )
  }
}

// ── Lógica IOL ─────────────────────────────────────────────────────────────
async function fetchFromIOL(
  assets:    AssetRow[],
  supabase:  DB,
  quoteDate: string,
  quoteTime: string,
) {
  const rates = await calculateRatesFromIOL()

  const iolTickers = [...new Set(assets.map(a => toIOLTicker(a.ticker)))]
  const quotes     = await getIOLQuotes(iolTickers)

  const inserts = assets.flatMap(a => {
    const iolTicker = toIOLTicker(a.ticker)
    const q         = quotes.get(iolTicker.toUpperCase())
    if (!q || q.ultimoPrecio <= 0) return []

    const bond  = isBond(a.asset_type as AssetType)
    const price = bond ? q.ultimoPrecio / 100 : q.ultimoPrecio

    return [{
      asset_id:   a.id,
      quote_date: quoteDate,
      quote_time: quoteTime,
      price,
      price_open: q.apertura > 0 ? (bond ? q.apertura / 100 : q.apertura) : null,
      price_high: q.maximo   > 0 ? (bond ? q.maximo   / 100 : q.maximo)   : null,
      price_low:  q.minimo   > 0 ? (bond ? q.minimo   / 100 : q.minimo)   : null,
      volume_24h: null,
      currency:   priceCurrency(a.ticker, a.asset_type as AssetType),
      source:     'IOL_API',
      is_closing: false,
    }]
  })

  if (inserts.length === 0) throw new Error('IOL returned no usable quotes')

  const { error: upsertErr } = await supabase
    .from('price_quotes')
    .upsert(inserts, { ignoreDuplicates: true })

  if (upsertErr) throw new Error(upsertErr.message)

  if (rates.mep && rates.ccl && rates.ccl_ticker_ars && rates.ccl_ticker_usd) {
    await supabase.from('fx_rates').insert({
      rate_date:      quoteDate,
      rate_time:      quoteTime,
      rate_mep:       rates.mep,
      rate_ccl:       rates.ccl,
      mep_ticker_ars: 'AL30',
      mep_ticker_usd: 'AL30D',
      ccl_ticker_ars: rates.ccl_ticker_ars,
      ccl_ticker_usd: rates.ccl_ticker_usd,
      source:         'IOL_CALCULADO',
    })
  }

  const assetById    = new Map(assets.map(a => [a.id, a.ticker]))
  const tickersFound = inserts.map(i => assetById.get(i.asset_id) ?? '')
  const tickersNotFound = assets
    .map(a => a.ticker)
    .filter(t => !tickersFound.includes(t))

  return {
    success:        true,
    source:         'IOL_API',
    assetsUpdated:  inserts.length,
    tickersFound,
    tickersNotFound,
    mep:            rates.mep,
    ccl:            rates.ccl,
  }
}

// ── Lógica PPI (fallback) ──────────────────────────────────────────────────
async function fetchFromPPI(
  assets:    AssetRow[],
  supabase:  DB,
  quoteDate: string,
  quoteTime: string,
) {
  const rates  = await calculateRatesFromPPI()
  const quotes = await getPPIQuotes(assets.map(a => ({
    ticker:     a.ticker,
    asset_type: a.asset_type as string,
  })))

  const inserts = assets.flatMap(a => {
    const q = quotes.get(a.ticker.toUpperCase())
    if (!q || q.price <= 0) return []

    const bond = isBond(a.asset_type as AssetType)
    return [{
      asset_id:   a.id,
      quote_date: quoteDate,
      quote_time: quoteTime,
      price:      bond ? q.price / 100 : q.price,
      price_open: q.openingPrice > 0 ? (bond ? q.openingPrice / 100 : q.openingPrice) : null,
      price_high: q.max          > 0 ? (bond ? q.max          / 100 : q.max)          : null,
      price_low:  q.min          > 0 ? (bond ? q.min          / 100 : q.min)          : null,
      volume_24h: q.volume       > 0 ? q.volume : null,
      currency:   priceCurrency(a.ticker, a.asset_type as AssetType),
      source:     'PPI_API',
      is_closing: false,
    }]
  })

  const { error: upsertErr } = await supabase
    .from('price_quotes')
    .upsert(inserts, { ignoreDuplicates: true })

  if (upsertErr) throw new Error(upsertErr.message)

  if (rates.mep && rates.ccl) {
    await supabase.from('fx_rates').insert({
      rate_date:      quoteDate,
      rate_time:      quoteTime,
      rate_mep:       rates.mep,
      rate_ccl:       rates.ccl,
      mep_ticker_ars: 'AL30',
      mep_ticker_usd: 'AL30D',
      ccl_ticker_ars: 'GD30',
      ccl_ticker_usd: 'GD30D',
      source:         'PPI_CALCULADO',
    })
  }

  const assetById    = new Map(assets.map(a => [a.id, a.ticker]))
  const tickersFound = inserts.map(i => assetById.get(i.asset_id) ?? '')
  const tickersNotFound = assets
    .map(a => a.ticker)
    .filter(t => !tickersFound.includes(t))

  return {
    success:        true,
    source:         'PPI_API',
    assetsUpdated:  inserts.length,
    tickersFound,
    tickersNotFound,
    mep:            rates.mep,
    ccl:            rates.ccl,
  }
}

// ── GET — cotización puntual de un ticker ──────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ticker    = searchParams.get('ticker')
  const assetType = searchParams.get('type') ?? 'ACCION_LOCAL'

  if (!ticker) {
    return Response.json({ error: 'ticker param required' }, { status: 400 })
  }

  // Intentar IOL primero
  try {
    const iolTicker = toIOLTicker(ticker)
    const { getIOLQuote } = await import('@/lib/iol/client')
    const quote = await getIOLQuote(iolTicker)
    return Response.json({ ticker, iolTicker, source: 'IOL', quote })
  } catch {
    // fallback a PPI
  }

  try {
    const type  = assetTypeToPPI(assetType)
    const quote = await getPPIQuote(ticker, type)
    return Response.json({ ticker, source: 'PPI', quote })
  } catch (e) {
    return Response.json(
      { error: 'Both IOL and PPI unavailable', detail: String(e) },
      { status: 503 },
    )
  }
}
