import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

function getBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// Horario BYMA: lunes–viernes 11:00–17:30 ART (UTC-3)
function isBYMAOpen(): boolean {
  const art = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const day     = art.getDay()
  const timeMin = art.getHours() * 60 + art.getMinutes()
  if (day === 0 || day === 6) return false
  return timeMin >= 11 * 60 && timeMin <= 17 * 60 + 30
}

// Acepta Authorization: Bearer <CRON_SECRET> (Vercel cron + trigger proxy)
// o x-cron-secret: <CRON_SECRET> (llamadas legacy / curl manual)
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true

  const authHeader  = req.headers.get('authorization')
  const cronHeader  = req.headers.get('x-cron-secret')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  return bearerToken === secret || cronHeader === secret
}

async function callInternal(
  path: string,
  method: 'GET' | 'POST' = 'POST',
): Promise<{ ok: boolean; data: unknown; ms: number }> {
  const start = Date.now()
  try {
    const res  = await fetch(`${getBaseUrl()}${path}`, { method })
    const data = await res.json()
    return { ok: res.ok, data, ms: Date.now() - start }
  } catch (e) {
    return { ok: false, data: { error: String(e) }, ms: Date.now() - start }
  }
}

export async function runMarketUpdate() {
  const bymaOpen  = isBYMAOpen()
  const timestamp = new Date().toISOString()
  const results: Record<string, unknown> = { timestamp, bymaOpen }

  // 1. FX rates — siempre
  results.fx = await callInternal('/api/fx-rates/update')

  // 2. TradFi — solo en horario BYMA
  if (bymaOpen) {
    results.tradfi = await callInternal('/api/prices/tradfi')
  } else {
    results.tradfi = { skipped: true, reason: 'BYMA cerrado' }
  }

  // 3. FCIs (CAFCI) — siempre
  results.fci = await callInternal('/api/prices/fci')

  // 4. Crypto — siempre
  results.crypto = await callInternal('/api/prices/crypto')

  const allOk = [results.fx, results.fci, results.crypto,
    ...(bymaOpen ? [results.tradfi] : []),
  ]
    .filter((r): r is { ok: boolean } => r != null && typeof r === 'object' && 'ok' in r)
    .every(r => r.ok)

  return { ...results, success: allOk }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runMarketUpdate()
  return Response.json(result, { status: (result as { success: boolean }).success ? 200 : 207 })
}

// GET para llamadas manuales desde browser/curl
export async function GET(req: NextRequest) {
  return POST(req)
}
