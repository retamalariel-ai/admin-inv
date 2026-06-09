import { createClient } from '@/lib/supabase/server'
import CommissionsDashboard from '@/components/commissions/CommissionsDashboard'

export default async function ComisionesPage() {
  const supabase = await createClient()

  const [
    { data: agreements },
    { data: records },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from('commission_agreements')
      .select('*, clients(id, full_name)')
      .is('effective_to', null)
      .order('effective_from', { ascending: false }),
    supabase
      .from('commission_records')
      .select('*, clients(full_name), commission_agreements(commission_type)')
      .order('period_to', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
  ])

  // Flatten nested relations
  type AgreementRow = NonNullable<typeof agreements>[number] & {
    client_name: string | null
  }
  const flatAgreements: AgreementRow[] = (agreements ?? []).map((a: any) => ({
    ...a,
    client_name: a.clients?.full_name ?? null,
  }))

  type RecordRow = NonNullable<typeof records>[number] & {
    client_name:      string | null
    commission_type:  string | null
  }
  const flatRecords: RecordRow[] = (records ?? []).map((r: any) => ({
    ...r,
    client_name:     r.clients?.full_name ?? null,
    commission_type: r.commission_agreements?.commission_type ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Comisiones</h1>
        <p className="text-sm text-slate-400 mt-1">
          Acuerdos vigentes y registro de devengamiento
        </p>
      </div>
      <CommissionsDashboard
        agreements={flatAgreements as any}
        records={flatRecords as any}
        clients={clients ?? []}
      />
    </div>
  )
}
