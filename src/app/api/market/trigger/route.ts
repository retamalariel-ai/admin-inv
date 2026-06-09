import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base   = new URL(req.url).origin
  const secret = process.env.CRON_SECRET
  const res    = await fetch(`${base}/api/market/update-all`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
