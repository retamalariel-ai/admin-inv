import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientHeader    from '@/components/clients/ClientHeader'
import ClientMetrics   from '@/components/clients/ClientMetrics'
import PortfoliosList  from '@/components/clients/PortfoliosList'

export default async function ClientePage(props: PageProps<'/clientes/[id]'>) {
  const { id } = await props.params
  const supabase = await createClient()

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

  return (
    <div className="space-y-8">
      <ClientHeader client={client} />
      <ClientMetrics positions={positions ?? []} />
      <PortfoliosList
        clientId={id}
        portfolios={portfolios ?? []}
        positions={positions ?? []}
      />
    </div>
  )
}
