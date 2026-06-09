import { createClient } from '@/lib/supabase/server'
import CryptoDashboard from '@/components/crypto/CryptoDashboard'
import type { Database } from '@/types/database.types'

type AssetType = Database['public']['Enums']['asset_type']

const CRYPTO_TYPES: AssetType[] = [
  'CRYPTO_SPOT', 'CRYPTO_STABLECOIN', 'CRYPTO_EARN',
  'CRYPTO_DEFI_LP', 'CRYPTO_DEFI_STAKE', 'CRYPTO_DEFI_LENDING',
  'CASH_CRYPTO_STABLE', 'CASH_CRYPTO_NATIVE',
]

export default async function CryptoPage() {
  const supabase = await createClient()

  const { data: positions } = await supabase
    .from('portfolio_valuation_unified')
    .select('*')
    .in('asset_type', CRYPTO_TYPES)
    .order('market_value_usd', { ascending: false, nullsFirst: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Crypto</h1>
        <p className="text-sm text-slate-400 mt-1">
          Spot, Earn y DeFi — {(positions ?? []).length} posiciones
        </p>
      </div>
      <CryptoDashboard positions={positions ?? []} today={new Date().toISOString().slice(0, 10)} />
    </div>
  )
}
