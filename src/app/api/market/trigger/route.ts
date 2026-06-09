import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = getBaseUrl()
  const res = await fetch(`${baseUrl}/api/market/update-all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
    },
  })

  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    const text = await res.text()
    console.error('[trigger] Non-JSON response:', text.substring(0, 200))
    return Response.json(
      { error: 'Internal error', detail: text.substring(0, 200) },
      { status: 500 },
    )
  }

  const data = await res.json()
  return Response.json(data)
}
