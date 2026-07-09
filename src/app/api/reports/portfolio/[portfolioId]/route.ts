import { createClient }                   from '@/lib/supabase/server'
import { renderPortfolioReportToBuffer }  from '@/lib/reports/PortfolioReport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/reports/portfolio/[portfolioId]'>,
) {
  const { portfolioId } = await ctx.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: portfolio } = await supabase
    .from('portfolios')
    .select('*, clients(full_name, email)')
    .eq('id', portfolioId)
    .single()

  if (!portfolio) {
    return Response.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  const { data: positions } = await supabase
    .from('portfolio_valuation_unified')
    .select('*')
    .eq('portfolio_id', portfolioId)

  const { data: allPositions } = await supabase
    .from('positions')
    .select(`
      quantity_held,
      realized_gain_loss_ars,
      realized_gain_loss_usd,
      total_cost_basis_ars,
      first_purchase_date,
      last_transaction_date,
      assets(ticker, name, asset_type)
    `)
    .eq('portfolio_id', portfolioId)

  const closedPositions = (allPositions ?? []).filter(
    p => Number(p.quantity_held) === 0 && Number(p.realized_gain_loss_ars ?? 0) !== 0,
  )

  const { data: fx } = await supabase
    .from('fx_rates')
    .select('rate_mep, rate_ccl, rate_oficial, rate_blue')
    .order('rate_date', { ascending: false })
    .order('rate_time', { ascending: false })
    .limit(1)
    .single()

  const fxRates = {
    mep:     Number(fx?.rate_mep     ?? 0),
    ccl:     Number(fx?.rate_ccl     ?? 0),
    oficial: Number(fx?.rate_oficial ?? 0),
    blue:    Number(fx?.rate_blue    ?? 0),
  }

  const clientData = Array.isArray(portfolio.clients)
    ? portfolio.clients[0]
    : portfolio.clients

  const generatedAt = new Date()

  const buffer = await renderPortfolioReportToBuffer({
    client:    { full_name: clientData?.full_name ?? 'Cliente', email: clientData?.email },
    portfolio: { name: portfolio.name, custodian_name: portfolio.custodian_name },
    positions:       positions       ?? [],
    closedPositions: closedPositions,
    fxRates,
    generatedAt,
    managerName: 'CFO Tech Partners',
  })

  const dateTag  = generatedAt.toISOString().split('T')[0]
  const filename = `cartera-${portfolio.name.replace(/\s+/g, '-')}-${dateTag}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
