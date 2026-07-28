import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import ClientHeader    from '@/components/clients/ClientHeader'
import ClientMetrics   from '@/components/clients/ClientMetrics'
import PortfoliosList  from '@/components/clients/PortfoliosList'
import type { EarnPosition } from '@/components/crypto/EarnTracker'

const STABLECOIN_TICKERS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'PYUSD', 'TUSD', 'FRAX'])

export default async function ClientePage(props: PageProps<'/clientes/[id]'>) {
  const { id } = await props.params
  const supabase = await createClient()
  // earn_positions no está en database.types.ts hasta aplicar la migración
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseSvc = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as any

  const [
    { data: client },
    { data: portfolios },
    { data: positions },
  ] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('portfolios').select('*').eq('client_id', id).order('inception_date'),
    supabase.from('portfolio_valuation_unified').select('*').eq('client_id', id),
  ])

  if (!client) notFound()

  const allPositions = positions ?? []

  // earn_positions filtradas por los portfolios del cliente
  const portfolioIds = (portfolios ?? []).map(p => p.id)
  const { data: rawEarnPositions } = portfolioIds.length > 0
    ? await supabaseSvc
        .from('earn_positions')
        .select(`
          id, asset_id, portfolio_id, principal_amount, apy_pct,
          platform, currency, start_date, notes,
          assets ( ticker, name ),
          portfolios ( name, custodian_name )
        `)
        .in('portfolio_id', portfolioIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  // priceMap desde posiciones spot para calcular principal_amount_usd
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

  return (
    <div className="space-y-8">
      <ClientHeader client={client} />
      <ClientMetrics positions={allPositions} earnPositions={earnPositions} />
      <PortfoliosList
        clientId={id}
        portfolios={portfolios ?? []}
        positions={allPositions}
        earnPositions={earnPositions}
      />
    </div>
  )
}
