import { createClient } from '@/lib/supabase/server'
import ConfigDashboard from '@/components/config/ConfigDashboard'

export default async function ConfigPage() {
  const supabase = await createClient()

  const [
    { data: assets },
    { data: fxRates },
    { data: latestPrices },
    { count: txCount },
    { count: clientCount },
    { data: aumData },
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('id, ticker, name, asset_type, currency, current_residual_factor, is_active, data_source, updated_at')
      .order('asset_type')
      .order('ticker'),
    supabase
      .from('fx_rates')
      .select('*')
      .order('rate_date', { ascending: false })
      .order('rate_time', { ascending: false, nullsFirst: false })
      .limit(30),
    supabase
      .from('price_quotes')
      .select('asset_id, quote_date, quote_time, price, currency, source, assets(ticker, name, asset_type)')
      .order('quote_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('is_cancelled', false),
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('portfolio_valuation_unified').select('market_value_usd'),
  ])

  // Dedup latest price per asset
  const seenAsset = new Set<string>()
  const dedupedPrices = (latestPrices ?? []).filter(p => {
    if (seenAsset.has(p.asset_id)) return false
    seenAsset.add(p.asset_id)
    return true
  })

  const totalAumUsd = (aumData ?? [])
    .reduce((sum, p) => sum + (p.market_value_usd ?? 0), 0)

  const lastPriceUpdate = dedupedPrices[0]?.quote_date ?? null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Configuración</h1>
        <p className="text-sm text-slate-400 mt-1">Activos, precios y parámetros del sistema</p>
      </div>
      <ConfigDashboard
        assets={(assets ?? []) as any}
        fxRates={fxRates ?? []}
        latestPrices={dedupedPrices as any}
        systemStats={{
          totalTransactions: txCount ?? 0,
          activeClients:     clientCount ?? 0,
          totalAumUsd,
          lastPriceUpdate,
          appVersion:        '0.1.0',
        }}
      />
    </div>
  )
}
