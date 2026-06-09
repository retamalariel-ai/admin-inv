import { createClient } from '@/lib/supabase/server'
import AUMSummary    from '@/components/dashboard/AUMSummary'
import ClientsTable  from '@/components/dashboard/ClientsTable'
import AllocationChart from '@/components/dashboard/AllocationChart'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: clientSummaries }, { data: allPositions }] = await Promise.all([
    supabase.from('client_aum_summary').select('*'),
    supabase
      .from('portfolio_valuation_unified')
      .select('asset_type, market_value_ars'),
  ])

  const clients   = clientSummaries ?? []
  const positions = allPositions    ?? []

  const totalAUMars      = clients.reduce((s, c) => s + (c.total_aum_ars            ?? 0), 0)
  const totalAUMusd      = clients.reduce((s, c) => s + (c.total_aum_usd            ?? 0), 0)
  const totalPnlARS      = clients.reduce((s, c) => s + (c.total_unrealized_pnl_ars ?? 0), 0)
  const totalPnlUSD      = clients.reduce((s, c) => s + (c.total_unrealized_pnl_usd ?? 0), 0)
  const portfolioCount   = clients.reduce((s, c) => s + (c.portfolio_count          ?? 0), 0)
  const hasDailyData     = clients.some(c => (c as any).total_daily_pnl_ars != null)
  const totalDailyPnlARS = hasDailyData
    ? clients.reduce((s, c) => s + ((c as any).total_daily_pnl_ars ?? 0), 0)
    : null

  const allocationMap = new Map<string, number>()
  for (const p of positions) {
    allocationMap.set(p.asset_type, (allocationMap.get(p.asset_type) ?? 0) + (p.market_value_ars ?? 0))
  }
  const allocationData = Array.from(allocationMap.entries()).map(
    ([asset_type, market_value_ars]) => ({ asset_type, market_value_ars })
  )

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Resumen consolidado de todos los portfolios
        </p>
      </div>

      {/* KPI Cards */}
      <AUMSummary
        totalAUMars={totalAUMars}
        totalAUMusd={totalAUMusd}
        totalPnlARS={totalPnlARS}
        totalPnlUSD={totalPnlUSD}
        totalDailyPnlARS={totalDailyPnlARS}
        clientCount={clients.length}
        portfolioCount={portfolioCount}
      />

      {/* Tabla de clientes + gráfico de composición */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-lg bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Clientes
            </h2>
          </div>
          <ClientsTable clients={clients} />
        </div>

        <div className="rounded-lg bg-card border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Composición AUM
            </h2>
          </div>
          <div className="p-4">
            <AllocationChart data={allocationData} />
          </div>
        </div>
      </div>
    </div>
  )
}
