import { createClient } from '@/lib/supabase/server'
import { runMarketUpdate } from '../update-all/route'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runMarketUpdate()
  return Response.json(result)
}
