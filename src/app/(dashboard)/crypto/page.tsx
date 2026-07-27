import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import CryptoDashboard, { type PortfolioGroup } from '@/components/crypto/CryptoDashboard'
import type { Database } from '@/types/database.types'
import type { EarnPosition } from '@/components/crypto/EarnTracker'

type AssetType = Database['public']['Enums']['asset_type']

const CRYPTO_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE',
]

const STABLECOIN_TICKERS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'PYUSD', 'TUSD', 'FRAX'])

const CUSTODIAN_ORDER: Record<string, number> = {
  EXCHANGE_CEX:  0,
  EARN_PLATFORM: 1,
  WALLET_HW:     2,
  WALLET_SW:     3,
  DEFI_PROTOCOL: 4,
  ALYCE:         5,
  OTRO:          6,
}

export default async function CryptoPage() {
  const supabase = await createClient()
  // earn_positions no está en database.types.ts hasta aplicar la migración
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseSvc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  const [{ data: positions }, { data: rawEarnPositions }] = await Promise.all([
    supabase
      .from('portfolio_valuation_unified')
      .select('*')
      .in('asset_type', CRYPTO_TYPES)
      .order('market_value_usd', { ascending: false, nullsFirst: false }),
    supabaseSvc
      .from('earn_positions')
      .select(`
        id, asset_id, portfolio_id, principal_amount, apy_pct,
        platform, currency, start_date, notes,
        assets ( ticker, name ),
        portfolios ( name, custodian_name )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  const allPositions = positions ?? []

  // priceMap: ticker → current_price (for earn AUM calculation)
  const priceMap = new Map<string, number>(
    allPositions
      .filter(p => p.ticker != null && p.current_price != null)
      .map(p => [p.ticker!.toUpperCase(), p.current_price as number]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earnPositions: EarnPosition[] = (rawEarnPositions ?? [] as any[]).map((ep: any) => {
    const ticker = (ep.assets?.ticker as string | undefined)?.toUpperCase()
    const price = ticker
      ? (STABLECOIN_TICKERS.has(ticker) ? 1 : (priceMap.get(ticker) ?? 1))
      : 1
    return { ...ep, principal_amount_usd: (ep.principal_amount as number) * price }
  })

  // Distinct portfolio IDs present in crypto positions
  const portfolioIds = [...new Set(allPositions.map(p => p.portfolio_id).filter(Boolean))] as string[]

  // Fetch portfolio metadata (custodian_type not in the view)
  const { data: portfolios } = portfolioIds.length > 0
    ? await supabase
        .from('portfolios')
        .select('id, name, custodian_name, custodian_type, base_currency')
        .in('id', portfolioIds)
    : { data: [] }

  // Build and sort groups
  const portfolioGroups: PortfolioGroup[] = (portfolios ?? [])
    .map(portfolio => ({
      portfolio,
      positions:     allPositions.filter(p => p.portfolio_id === portfolio.id),
      earnPositions: earnPositions.filter(ep => ep.portfolio_id === portfolio.id),
    }))
    .sort((a, b) => {
      const ao = CUSTODIAN_ORDER[a.portfolio.custodian_type ?? ''] ?? 99
      const bo = CUSTODIAN_ORDER[b.portfolio.custodian_type ?? ''] ?? 99
      if (ao !== bo) return ao - bo
      // secondary: AUM descending
      const aAum = a.positions.reduce((s, p) => s + (p.market_value_usd ?? 0), 0)
      const bAum = b.positions.reduce((s, p) => s + (p.market_value_usd ?? 0), 0)
      return bAum - aAum
    })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Crypto</h1>
        <p className="text-sm text-slate-400 mt-1">
          {portfolioGroups.length} plataformas · {allPositions.length} posiciones
        </p>
      </div>
      <CryptoDashboard
        portfolioGroups={portfolioGroups}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  )
}
