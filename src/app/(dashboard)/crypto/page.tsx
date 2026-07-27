import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import CryptoDashboard from '@/components/crypto/CryptoDashboard'
import type { Database } from '@/types/database.types'
import type { EarnPosition } from '@/components/crypto/EarnTracker'

type AssetType = Database['public']['Enums']['asset_type']

const CRYPTO_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE',
]

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

  const earnPositions: EarnPosition[] = rawEarnPositions ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Crypto</h1>
        <p className="text-sm text-slate-400 mt-1">
          Spot, Earn y DeFi — {(positions ?? []).length} posiciones
        </p>
      </div>
      <CryptoDashboard
        positions={positions ?? []}
        earnPositions={earnPositions ?? []}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  )
}
