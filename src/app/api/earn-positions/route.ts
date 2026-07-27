import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// earn_positions no está en database.types.ts hasta aplicar la migración
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function svc(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/earn-positions
export async function GET() {
  const { data, error } = await svc()
    .from('earn_positions')
    .select(`
      id, asset_id, portfolio_id, principal_amount, apy_pct,
      platform, currency, start_date, is_active, notes,
      assets ( ticker, name, asset_type ),
      portfolios ( name, custodian_name )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST /api/earn-positions — upsert por asset+portfolio+platform
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Body inválido' }, { status: 400 })

  const { asset_id, portfolio_id, principal_amount, apy_pct, platform, currency, start_date, notes } = body

  if (!asset_id || !portfolio_id || principal_amount == null || apy_pct == null) {
    return Response.json(
      { error: 'asset_id, portfolio_id, principal_amount y apy_pct son requeridos' },
      { status: 400 },
    )
  }

  const { data, error } = await svc()
    .from('earn_positions')
    .upsert({
      asset_id,
      portfolio_id,
      principal_amount: parseFloat(principal_amount),
      apy_pct:          parseFloat(apy_pct),
      platform:         platform ?? null,
      currency:         currency ?? 'USDT',
      start_date:       start_date ?? new Date().toISOString().slice(0, 10),
      notes:            notes ?? null,
      is_active:        true,
    }, { onConflict: 'asset_id,portfolio_id,platform' })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
