import { createClient } from '@/lib/supabase/server'
import PatrimonioDashboard from '@/components/personal-finance/PatrimonioDashboard'

export default async function PatrimonioPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const [
    { data: portfolios },
    { data: valuations },
    { data: ownerships },
    { data: accounts },
    { data: installments },
    { data: fxRow },
  ] = await Promise.all([
    // Todos los portfolios activos con su cliente
    supabase
      .from('portfolios')
      .select('id, name, custodian_name, clients(full_name)')
      .eq('is_active', true)
      .order('name'),

    // AUM por posición desde la vista unificada
    supabase
      .from('portfolio_valuation_unified')
      .select('portfolio_id, market_value_ars, market_value_usd'),

    // Configuración de propiedad personal
    supabase
      .from('personal_portfolio_ownership')
      .select('portfolio_id, ownership_pct, include_in_patrimony'),

    // Cuentas personales
    supabase
      .from('personal_accounts')
      .select('id, name, type, currency, current_balance')
      .eq('is_active', true)
      .order('currency')
      .order('name'),

    // Cuotas activas (pasivos)
    supabase
      .from('personal_installments')
      .select('id, installment_amount, currency, total_installments, paid_installments, is_active, personal_cards(name)')
      .eq('is_active', true),

    // MEP
    supabase
      .from('fx_rates')
      .select('rate')
      .eq('pair', 'USD_ARS_MEP')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  // Agregar AUM por portfolio en TypeScript
  const aumByPortfolio: Record<string, { ars: number; usd: number }> = {}
  for (const row of (valuations ?? [])) {
    const id = row.portfolio_id as string
    aumByPortfolio[id] ??= { ars: 0, usd: 0 }
    aumByPortfolio[id].ars += Number(row.market_value_ars ?? 0)
    aumByPortfolio[id].usd += Number(row.market_value_usd ?? 0)
  }

  // Normalizar ownerships a mapa
  const initialOwnerships: Record<string, { pct: number; include: boolean }> = {}
  for (const row of (ownerships ?? [])) {
    initialOwnerships[row.portfolio_id] = {
      pct:     Number(row.ownership_pct),
      include: row.include_in_patrimony ?? true,
    }
  }

  return (
    <PatrimonioDashboard
      portfolios={          portfolios          ?? []}
      aumByPortfolio={      aumByPortfolio}
      initialOwnerships={   initialOwnerships}
      accounts={            accounts            ?? []}
      installments={        installments        ?? []}
      fxMep={               fxRow?.rate         ?? null}
    />
  )
}
