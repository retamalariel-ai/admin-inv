import { createClient } from '@/lib/supabase/server'
import TransaccionesDashboard from '@/components/personal-finance/TransaccionesDashboard'

export default async function TransaccionesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [
    { data: transactions },
    { data: accounts },
    { data: categories },
    { data: fxMep },
    { data: fxCcl },
  ] = await Promise.all([
    supabase
      .from('personal_transactions')
      .select('*, personal_categories(name, icon), personal_accounts(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),

    supabase
      .from('personal_accounts')
      .select('id, name, currency')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('personal_categories')
      .select('id, name, type, icon')
      .eq('is_active', true)
      .order('type')
      .order('name'),

    supabase
      .from('fx_rates')
      .select('rate')
      .eq('pair', 'USD_ARS_MEP')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('fx_rates')
      .select('rate')
      .eq('pair', 'USD_ARS_CCL')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <TransaccionesDashboard
      initialTransactions={transactions ?? []}
      accounts={accounts ?? []}
      categories={categories ?? []}
      fx={{ mep: fxMep?.rate ?? null, ccl: fxCcl?.rate ?? null }}
    />
  )
}
