import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortfolioSummary from '@/components/portfolio/PortfolioSummary'
import PositionsTable   from '@/components/portfolio/PositionsTable'
import PortfolioHeader  from '@/components/portfolio/PortfolioHeader'

export default async function PortfolioPage(props: PageProps<'/clientes/[id]/portfolio/[portfolioId]'>) {
  const { id, portfolioId } = await props.params
  const supabase = await createClient()

  const [{ data: portfolio }, { data: positions }] = await Promise.all([
    supabase.from('portfolios').select('*').eq('id', portfolioId).single(),
    supabase.from('portfolio_valuation_unified').select('*').eq('portfolio_id', portfolioId),
  ])

  if (!portfolio) notFound()

  const rows = positions ?? []

  return (
    <div className="space-y-8">
      <PortfolioHeader portfolio={portfolio} clientId={id} portfolioId={portfolioId} />
      <PortfolioSummary positions={rows} />

      <div>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Posiciones ({rows.length})
        </h2>
        <PositionsTable portfolioId={portfolioId} positions={rows} />
      </div>
    </div>
  )
}
