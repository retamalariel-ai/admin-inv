import { createClient } from '@/lib/supabase/server'
import PresupuestoDashboard from '@/components/personal-finance/PresupuestoDashboard'

export default async function PresupuestoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [{ data: categories }, { data: transactions }] = await Promise.all([
    supabase
      .from('personal_categories')
      .select('id, name, icon, budget_amount')
      .eq('type', 'EGRESO')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('personal_transactions')
      .select('category_id, amount, currency, amount_ars, date')
      .eq('type', 'EGRESO')
      .order('date', { ascending: false }),
  ])

  return (
    <PresupuestoDashboard
      initialCategories={categories   ?? []}
      allTransactions={  transactions ?? []}
    />
  )
}
