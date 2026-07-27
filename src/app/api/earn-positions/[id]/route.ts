import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function svc(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// PUT /api/earn-positions/[id] — actualiza principal y/o APY
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Body inválido' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body.principal_amount != null) patch.principal_amount = parseFloat(body.principal_amount)
  if (body.apy_pct          != null) patch.apy_pct          = parseFloat(body.apy_pct)
  if (body.platform         != null) patch.platform         = body.platform
  if (body.start_date       != null) patch.start_date       = body.start_date
  if (body.notes            != null) patch.notes            = body.notes

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Ningún campo para actualizar' }, { status: 400 })
  }

  const { data, error } = await svc()
    .from('earn_positions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// PATCH /api/earn-positions/[id] — desactiva (soft delete)
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data, error } = await svc()
    .from('earn_positions')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
