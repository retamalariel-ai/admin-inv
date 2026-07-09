import { createClient } from '@/lib/supabase/server'
import CuentasDashboard from '@/components/personal-finance/CuentasDashboard'

export default async function CuentasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [{ data: accounts }, { data: fx }] = await Promise.all([
    supabase
      .from('personal_accounts')
      .select('*')
      .eq('is_active', true)
      .order('currency')
      .order('name'),

    supabase
      .from('fx_rates')
      .select('rate')
      .eq('pair', 'USD_ARS_MEP')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const fxMep: number | null = fx?.rate ?? null

  return (
    <CuentasDashboard
      initialAccounts={accounts ?? []}
      fxMep={fxMep}
    />
  )
}
