import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Horario BYMA: lunes–viernes 11:00–17:30 ART (UTC-3)
function isBYMAOpen(): boolean {
  const now = new Date()
  // Convertir a UTC-3
  const art = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const day  = art.getDay()   // 0=Dom 6=Sáb
  const hour = art.getHours()
  const min  = art.getMinutes()
  const timeMin = hour * 60 + min

  if (day === 0 || day === 6) return false                 // fines de semana
  return timeMin >= 11 * 60 && timeMin <= 17 * 60 + 30    // 11:00–17:30
}

// Acepta Authorization: Bearer <CRON_SECRET> (Vercel cron + trigger proxy)
// o x-cron-secret: <CRON_SECRET> (llamadas legacy / curl manual)
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true   // en dev sin secret, permitir siempre

  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')

  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  return bearerToken === secret || cronHeader === secret
}

async function callInternal(
  req: NextRequest,
  path: string,
  method: 'GET' | 'POST' = 'POST',
): Promise<{ ok: boolean; data: unknown; ms: number }> {
  const base   = new URL(req.url).origin
  const start  = Date.now()
  try {
    const res  = await fetch(`${base}${path}`, { method })
    const data = await res.json()
    return { ok: res.ok, data, ms: Date.now() - start }
  } catch (e) {
    return { ok: false, data: { error: String(e) }, ms: Date.now() - start }
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bymaOpen  = isBYMAOpen()
  const timestamp = new Date().toISOString()
  const results: Record<string, unknown> = { timestamp, bymaOpen }

  // 1. FX rates — siempre (PPI + dolarapi, mercados 24/7 para oficial/blue)
  const fxResult = await callInternal(req, '/api/fx-rates/update')
  results.fx = fxResult

  // 2. TradFi — solo en horario BYMA
  if (bymaOpen) {
    const tradfiResult = await callInternal(req, '/api/prices/tradfi')
    results.tradfi = tradfiResult
  } else {
    results.tradfi = { skipped: true, reason: 'BYMA cerrado' }
  }

  // 3. FCIs (CAFCI) — siempre (VCP se publica al cierre, disponible 24/7)
  const fciResult = await callInternal(req, '/api/prices/fci')
  results.fci = fciResult

  // 4. Crypto — siempre (mercado 24/7)
  const cryptoResult = await callInternal(req, '/api/prices/crypto')
  results.crypto = cryptoResult

  const allOk = [fxResult, fciResult, ...(bymaOpen ? [results.tradfi as { ok: boolean }] : []), cryptoResult]
    .filter((r): r is { ok: boolean } => 'ok' in r)
    .every(r => r.ok)

  return Response.json(results, { status: allOk ? 200 : 207 })
}

// GET para llamadas manuales desde browser/curl
export async function GET(req: NextRequest) {
  return POST(req)
}
