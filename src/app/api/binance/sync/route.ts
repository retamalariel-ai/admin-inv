// POST /api/binance/sync
// Fetches trades from Binance for configured symbols, deduplicates by external_id,
// inserts new transactions, and recalculates positions.

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SYMBOLS = ['SOLUSDT', 'XRPUSDT', 'LTCUSDT', 'LINKUSDT'] as const

interface BinanceTrade {
  id:              number
  orderId:         number
  symbol:          string
  price:           string
  qty:             string
  quoteQty:        string
  commission:      string
  commissionAsset: string
  time:            number   // epoch ms
  isBuyer:         boolean
  isMaker:         boolean
}

interface FxRow {
  rate_date: string
  rate_ccl:  number | null
  rate_mep:  number | null
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function extractBase(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol
}

async function fetchBinanceTrades(symbol: string): Promise<BinanceTrade[]> {
  const apiKey    = process.env.BINANCE_API_KEY!
  const secretKey = process.env.BINANCE_API_SECRET!
  const params = new URLSearchParams({
    symbol,
    limit:     '1000',
    startTime: new Date('2026-05-28T00:00:00Z').getTime().toString(),
    timestamp: Date.now().toString(),
  })
  const qs  = params.toString()
  const sig = crypto.createHmac('sha256', secretKey).update(qs).digest('hex')

  const res = await fetch(
    `https://api.binance.com/api/v3/myTrades?${qs}&signature=${sig}`,
    {
      headers: { 'X-MBX-APIKEY': apiKey },
      next:    { revalidate: 0 },
    },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Binance ${symbol}: HTTP ${res.status} — ${text}`)
  }

  return res.json() as Promise<BinanceTrade[]>
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { portfolioId?: string }
    const { portfolioId } = body

    if (!portfolioId) {
      return Response.json({ error: 'portfolioId requerido' }, { status: 400 })
    }

    if (!process.env.BINANCE_API_KEY || !process.env.BINANCE_API_SECRET) {
      return Response.json(
        { error: 'BINANCE_API_KEY y BINANCE_API_SECRET no están configurados' },
        { status: 500 },
      )
    }

    const supabase  = serviceClient()
    const errors:    string[] = []
    let synced  = 0
    let skipped = 0

    // ── Lookup assets by ticker ──────────────────────────────────────────────
    const tickers = SYMBOLS.map(s => extractBase(s))
    const { data: assetsData } = await supabase
      .from('assets')
      .select('id, ticker')
      .in('ticker', tickers)

    const assetMap = new Map((assetsData ?? []).map(a => [a.ticker.toUpperCase(), a.id]))

    // ── Fetch trades from Binance for each symbol ────────────────────────────
    type SymbolTrades = { symbol: string; trades: BinanceTrade[] }
    const symbolTradesList: SymbolTrades[] = []

    for (const symbol of SYMBOLS) {
      try {
        const trades = await fetchBinanceTrades(symbol)
        symbolTradesList.push({ symbol, trades })
      } catch (err) {
        errors.push(String(err))
      }
    }

    if (symbolTradesList.length === 0) {
      return Response.json({ synced: 0, skipped: 0, errors })
    }

    // ── Collect all external IDs to skip already-imported trades ────────────
    const allExternalIds = symbolTradesList
      .flatMap(({ trades }) => trades.map(t => t.id.toString()))

    const existingSet = new Set<string>()
    if (allExternalIds.length > 0) {
      const { data: existing } = await supabase
        .from('transactions')
        .select('external_id')
        .eq('portfolio_id', portfolioId)
        .in('external_id', allExternalIds)
      ;(existing ?? []).forEach(r => { if (r.external_id) existingSet.add(r.external_id) })
    }

    // ── Batch-fetch FX rates from earliest trade date ────────────────────────
    const allDates = new Set<string>()
    for (const { trades } of symbolTradesList) {
      for (const trade of trades) {
        allDates.add(new Date(trade.time).toISOString().slice(0, 10))
      }
    }

    const sortedDates = Array.from(allDates).sort()
    const startDate   = sortedDates[0]

    let sortedFX: FxRow[] = []
    if (startDate) {
      const { data: fxRates } = await supabase
        .from('fx_rates')
        .select('rate_date, rate_ccl, rate_mep')
        .gte('rate_date', startDate)
        .not('rate_ccl', 'is', null)
        .order('rate_date', { ascending: true })
      sortedFX = (fxRates ?? []) as FxRow[]
    }

    function lookupFX(date: string): { ccl: number | null; mep: number | null } {
      let lo = 0, hi = sortedFX.length - 1, best = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (sortedFX[mid].rate_date <= date) { best = mid; lo = mid + 1 }
        else hi = mid - 1
      }
      if (best < 0) return { ccl: null, mep: null }
      return {
        ccl: sortedFX[best].rate_ccl != null ? Number(sortedFX[best].rate_ccl) : null,
        mep: sortedFX[best].rate_mep != null ? Number(sortedFX[best].rate_mep) : null,
      }
    }

    // ── Insert new trades ────────────────────────────────────────────────────
    const affected = new Set<string>()   // `${portfolioId}:${assetId}`

    for (const { symbol, trades } of symbolTradesList) {
      const ticker  = extractBase(symbol)
      const assetId = assetMap.get(ticker)

      if (!assetId) {
        errors.push(`Activo no encontrado en DB: ${ticker}`)
        continue
      }

      for (const trade of trades) {
        const extId = trade.id.toString()

        if (existingSet.has(extId)) {
          skipped++
          continue
        }

        const tradeDate = new Date(trade.time).toISOString().slice(0, 10)
        const fx        = lookupFX(tradeDate)
        const qty       = parseFloat(trade.qty)
        const price     = parseFloat(trade.price)
        const totalUSD  = parseFloat(trade.quoteQty)

        const { error } = await supabase.from('transactions').insert({
          portfolio_id:             portfolioId,
          asset_id:                 assetId,
          external_id:              extId,
          transaction_type:         trade.isBuyer ? 'COMPRA' : 'VENTA',
          trade_date:               tradeDate,
          settlement_date:          tradeDate,
          quantity:                 qty,
          price_per_unit:           price,
          // Amounts in USD — trigger converts to ARS using fx_rate_mep
          gross_amount:             totalUSD,
          net_amount:               totalUSD,
          alyce_commission:         0,
          gas_fee_amount:           parseFloat(trade.commission),
          other_fees:               0,
          currency:                 'USDT',
          fx_rate_ccl:              fx.ccl,
          fx_rate_mep:              fx.mep,
          residual_factor_at_trade: 1,
          notes: `Fuente: Binance API | orderId: ${trade.orderId}`,
        })

        if (error) {
          errors.push(`Trade ${extId}: ${error.message}`)
          continue
        }

        synced++
        affected.add(`${portfolioId}:${assetId}`)
      }
    }

    // ── Recalculate positions for each affected asset ────────────────────────
    for (const key of affected) {
      const [pid, aid] = key.split(':')
      const { error } = await supabase.rpc('recalculate_position', {
        p_portfolio_id: pid,
        p_asset_id:     aid,
      })
      if (error) errors.push(`recalculate_position(${aid}): ${error.message}`)
    }

    return Response.json({ synced, skipped, errors })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[binance/sync] Error:', message)
    return Response.json({ synced: 0, skipped: 0, errors: [message] }, { status: 500 })
  }
}
