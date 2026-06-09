import { createClient } from '@/lib/supabase/server'
import ClientsList from '@/components/clients/ClientsList'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('full_name')

  const rows = clients ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-sm text-slate-400 mt-1">
            {rows.length} cliente{rows.length !== 1 ? 's' : ''} activo{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <ClientsList clients={rows} />
    </div>
  )
}
