import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortfolioSummary      from '@/components/portfolio/PortfolioSummary'
import PositionsTable        from '@/components/portfolio/PositionsTable'
import PortfolioHeader       from '@/components/portfolio/PortfolioHeader'
import ClosedPositionsTable  from '@/components/portfolio/ClosedPositionsTable'

export default async function PortfolioPage(props: PageProps<'/clientes/[id]/portfolio/[portfolioId]'>) {
  const { id, portfolioId } = await props.params
  const supabase = await createClient()

  const [{ data: portfolio }, { data: positions }, { data: allPositions }] = await Promise.all([
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
  ])

  if (!portfolio) notFound()

  const rows           = positions ?? []
  const allPos         = allPositions ?? []
  const closedPositions = allPos.filter(
    p => Number(p.quantity_held) === 0 && Number(p.realized_gain_loss_ars ?? 0) !== 0,
  )

  return (
    <div className="space-y-8">
      <PortfolioHeader portfolio={portfolio} clientId={id} portfolioId={portfolioId} />
      <PortfolioSummary positions={rows} allPositions={allPos} baseCurrency={portfolio.base_currency} />

      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Posiciones ({rows.length})
        </h2>
        <PositionsTable portfolioId={portfolioId} positions={rows} />
      </div>

      <ClosedPositionsTable positions={closedPositions} />
    </div>
  )
}
