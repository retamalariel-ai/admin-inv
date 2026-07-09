import { createClient } from '@/lib/supabase/server'
import SuscripcionesDashboard from '@/components/personal-finance/SuscripcionesDashboard'

export default async function SuscripcionesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [
    { data: subs },
    { data: cards },
    { data: categories },
    { data: fxMep },
  ] = await Promise.all([
    supabase
      .from('personal_subscriptions')
      .select('*, personal_cards(name), personal_categories(name, icon)')
      .eq('is_active', true)
      .order('next_due_date', { ascending: true, nullsLast: true }),

    supabase
      .from('personal_cards')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('personal_categories')
      .select('id, name, icon')
      .eq('type', 'EGRESO')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('fx_rates')
      .select('rate')
      .eq('pair', 'USD_ARS_MEP')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <SuscripcionesDashboard
      initialSubs={subs       ?? []}
      cards={      cards      ?? []}
      categories={ categories ?? []}
      fxMep={      fxMep?.rate ?? null}
    />
  )
}
