import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import PortfolioSummary      from '@/components/portfolio/PortfolioSummary'
import PositionsTable        from '@/components/portfolio/PositionsTable'
import PortfolioHeader       from '@/components/portfolio/PortfolioHeader'
import ClosedPositionsTable  from '@/components/portfolio/ClosedPositionsTable'
import EarnTracker           from '@/components/crypto/EarnTracker'
import type { EarnPosition } from '@/components/crypto/EarnTracker'

const STABLECOIN_TICKERS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'PYUSD', 'TUSD', 'FRAX'])

function getBaseToken(ticker: string): string {
  return ticker.split('-')[0].toUpperCase()
}

export default async function PortfolioPage(props: PageProps<'/clientes/[id]/portfolio/[portfolioId]'>) {
  const { id, portfolioId } = await props.params
  const supabase = await createClient()
  // earn_positions no está en database.types.ts hasta aplicar la migración
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseSvc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  const [
    { data: portfolio },
    { data: positions },
    { data: allPositions },
    { data: rawEarnPositions },
  ] = await Promise.all([
    supabase.from('portfolios').select('*').eq('id', portfolioId).single(),
    supabase.from('portfolio_valuation_unified').select('*').eq('portfolio_id', portfolioId),
    supabase
      .from('positions')
      .select(`
        quantity_held,
        realized_gain_loss_ars,
        realized_gain_loss_usd,
        total_income_received_ars,
        total_income_received_usd,
        total_cost_basis_ars,
        first_purchase_date,
        last_transaction_date,
        assets(ticker, name, asset_type)
      `)
      .eq('portfolio_id', portfolioId),
    supabaseSvc
      .from('earn_positions')
      .select(`
        id, asset_id, portfolio_id, principal_amount, apy_pct,
        platform, currency, start_date, notes,
        assets ( ticker, name ),
        portfolios ( name, custodian_name )
      `)
      .eq('portfolio_id', portfolioId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (!portfolio) notFound()

  const rows            = positions ?? []
  const allPos          = allPositions ?? []
  const closedPositions = allPos.filter(
    p => Number(p.quantity_held) === 0 && Number(p.realized_gain_loss_ars ?? 0) !== 0,
  )

  // priceMap: ticker → current_price desde posiciones spot
  const priceMap = new Map<string, number>(
    rows
      .filter(p => p.ticker != null && p.current_price != null)
      .map(p => [p.ticker!.toUpperCase(), p.current_price as number]),
  )

  // Tickers de earn sin precio en priceMap → buscar fallback en price_quotes
  const rawEarnArr = (rawEarnPositions ?? []) as any[]
  const missingTickers = [...new Set(
    rawEarnArr.flatMap((ep: any) => {
      const ticker = (ep.assets?.ticker as string | undefined)?.toUpperCase() ?? ''
      const base   = getBaseToken(ticker)
      if (STABLECOIN_TICKERS.has(base) || STABLECOIN_TICKERS.has(ticker)) return []
      if (priceMap.has(base) || priceMap.has(ticker)) return []
      return [base]
    }),
  )]

  // eslint-disable-next-line prefer-const
  let fallbackMap = new Map<string, number>()
  if (missingTickers.length > 0) {
    const { data: assetRows } = await supabase
      .from('assets')
      .select('id, ticker')
      .in('ticker', missingTickers)
    const idToTicker = new Map(
      (assetRows ?? []).map(a => [a.id as string, (a.ticker as string).toUpperCase()])
    )
    const assetIds = [...idToTicker.keys()]
    if (assetIds.length > 0) {
      const { data: pqRows } = await supabaseSvc
        .from('price_quotes')
        .select('asset_id, price')
        .in('asset_id', assetIds)
        .order('quote_date', { ascending: false })
        .limit(assetIds.length * 5)
      for (const row of ((pqRows ?? []) as { asset_id: string; price: number }[])) {
        const t = idToTicker.get(row.asset_id)
        if (t && !fallbackMap.has(t)) fallbackMap.set(t, Number(row.price))
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earnPositions: EarnPosition[] = rawEarnArr.map((ep: any) => {
    const ticker     = (ep.assets?.ticker as string | undefined)?.toUpperCase() ?? ''
    const baseTicker = getBaseToken(ticker)
    const isStable   = STABLECOIN_TICKERS.has(baseTicker) || STABLECOIN_TICKERS.has(ticker)
    // null = sin precio disponible tras agotar priceMap y fallbackMap
    const price      = isStable ? 1
      : (priceMap.get(baseTicker) ?? priceMap.get(ticker)
         ?? fallbackMap.get(baseTicker) ?? fallbackMap.get(ticker)
         ?? null)
    return {
      ...ep,
      principal_amount_usd: price != null ? (ep.principal_amount as number) * price : null,
    }
  })

  const totalAUM = rows.reduce((s, p) => s + Number(p.market_value_ars ?? 0), 0)

  return (
    <div className="space-y-8">
      <PortfolioHeader portfolio={portfolio} clientId={id} portfolioId={portfolioId} />
      <PortfolioSummary
        positions={rows}
        allPositions={allPos}
        baseCurrency={portfolio.base_currency}
        earnPositions={earnPositions}
      />

      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Posiciones ({rows.length})
        </h2>
        <PositionsTable
          portfolioId={portfolioId}
          positions={rows}
          baseCurrency={portfolio.base_currency}
          totalAUM={totalAUM}
        />
      </div>

      {earnPositions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Earn / DeFi ({earnPositions.length})
          </h2>
          <EarnTracker earnPositions={earnPositions} />
        </div>
      )}

      <ClosedPositionsTable positions={closedPositions} />
    </div>
  )
}
