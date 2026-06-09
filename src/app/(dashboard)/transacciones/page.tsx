import { createClient } from '@/lib/supabase/server'
import TransactionsList from '@/components/transactions/TransactionsList'

export default async function TransaccionesPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('transactions')
    .select(`
      id,
      trade_date,
      transaction_type,
      quantity,
      price_per_unit,
      net_amount,
      currency,
      is_cancelled,
      assets ( ticker, name ),
      portfolios ( name, clients ( full_name ) )
    `)
    .eq('is_cancelled', false)
    .order('trade_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  // Supabase devuelve relaciones anidadas como objetos (FK → one record)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((tx: any) => ({
    id:               tx.id as string,
    trade_date:       tx.trade_date as string,
    transaction_type: tx.transaction_type as string,
    quantity:         tx.quantity as number | null,
    price_per_unit:   tx.price_per_unit as number | null,
    net_amount:       tx.net_amount as number | null,
    currency:         tx.currency as string,
    is_cancelled:     tx.is_cancelled as boolean,
    ticker:           tx.assets?.ticker ?? null,
    asset_name:       tx.assets?.name ?? null,
    portfolio_name:   tx.portfolios?.name ?? null,
    client_name:      tx.portfolios?.clients?.full_name ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Transacciones</h1>
        <p className="text-sm text-slate-400 mt-1">
          Últimas 100 transacciones · solo activas
        </p>
      </div>

      <TransactionsList rows={rows} />
    </div>
  )
}
