import { createClient } from '@/lib/supabase/server'
import CMDashboard from '@/components/capital-markets/CMDashboard'
import type { Database } from '@/types/database.types'

type AssetType = Database['public']['Enums']['asset_type']

const CM_TYPES: AssetType[] = [
  'ACCION_LOCAL', 'CEDEAR', 'BONO_SOBERANO', 'BONO_SUBSOBERANO',
  'ON', 'LETES', 'LECAP',
  'FCI_MONEY_MARKET', 'FCI_RENTA_FIJA', 'FCI_RENTA_VARIABLE', 'FCI_RENTA_MIXTA',
]

export default async function CapitalMarketsPage() {
  const supabase = await createClient()

  const [{ data: positions }, { data: cedears }] = await Promise.all([
    supabase
      .from('portfolio_valuation_unified')
      .select('*')
      .in('asset_type', CM_TYPES)
      .order('market_value_ars', { ascending: false, nullsFirst: false }),
    supabase
      .from('assets')
      .select('ticker, cedear_ratio')
      .eq('asset_type', 'CEDEAR')
      .not('cedear_ratio', 'is', null),
  ])

  const cedearRatios: Record<string, number> = Object.fromEntries(
    (cedears ?? []).map(c => [c.ticker, c.cedear_ratio!]),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Capital Markets</h1>
        <p className="text-sm text-slate-400 mt-1">
          Renta variable, renta fija y fondos — {(positions ?? []).length} posiciones
        </p>
      </div>
      <CMDashboard positions={positions ?? []} cedearRatios={cedearRatios} />
    </div>
  )
}
