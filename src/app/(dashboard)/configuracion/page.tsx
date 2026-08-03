import { createClient } from '@/lib/supabase/server'
import FXRatesTable from '@/components/configuracion/FXRatesTable'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionPage() {
  const supabase = await createClient()

  const { data: rates } = await supabase
    .from('fx_rates')
    .select('rate_date, rate_mep, rate_ccl, rate_blue, rate_oficial, source, rate_time')
    .order('rate_date', { ascending: false })
    .order('rate_time', { ascending: false, nullsFirst: false })
    .limit(90)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Tipos de Cambio</h1>
        <p className="text-sm text-slate-400 mt-1">
          Historial de MEP, CCL, Blue y Oficial — últimos 90 registros
        </p>
      </div>

      <FXRatesTable rates={rates ?? []} />
    </div>
  )
}
