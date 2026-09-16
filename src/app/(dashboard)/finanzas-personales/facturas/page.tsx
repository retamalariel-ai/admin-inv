import { createClient } from '@/lib/supabase/server'
import FacturasDashboard from '@/components/personal-finance/FacturasDashboard'

export const dynamic = 'force-dynamic'

export default async function FacturasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [{ data: facturas }, { data: accounts }] = await Promise.all([
    supabase
      .from('personal_facturas')
      .select('*')
      .order('fecha_emision', { ascending: false }),

    supabase
      .from('personal_accounts')
      .select('id, name, currency')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <FacturasDashboard
      initialFacturas={facturas  ?? []}
      accounts={        accounts ?? []}
    />
  )
}
