import { createClient } from '@/lib/supabase/server'
import TarjetasDashboard from '@/components/personal-finance/TarjetasDashboard'

export default async function TarjetasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [{ data: cards }, { data: installments }, { data: categories }] = await Promise.all([
    supabase
      .from('personal_cards')
      .select('*')
      .eq('is_active', true)
      .order('name'),

    supabase
      .from('personal_installments')
      .select('*, personal_categories(name, icon)')
      .eq('is_active', true),

    supabase
      .from('personal_categories')
      .select('id, name, icon')
      .eq('type', 'EGRESO')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <TarjetasDashboard
      initialCards={        cards        ?? [] }
      initialInstallments={ installments ?? [] }
      categories={          categories   ?? [] }
    />
  )
}
