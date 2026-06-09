import { NextResponse } from 'next/server'

const IOL_BASE = 'https://api.invertironline.com'

export async function GET() {
  const username = process.env.IOL_USERNAME
  const password = process.env.IOL_PASSWORD

  if (!username || !password) {
    return NextResponse.json({
      auth: 'failed',
      error: 'IOL_USERNAME o IOL_PASSWORD no configurados en .env.local',
    }, { status: 500 })
  }

  // ── PASO 1: autenticación OAuth2 resource-owner password ──────────────────
  let token: string | null = null
  let tokenPreview: string | null = null
  let authError: string | null = null

  const tokenBody = new URLSearchParams({
    username,
    password,
    grant_type: 'password',
  })

  let tokenRaw: unknown = null
  try {
    const tokenRes = await fetch(`${IOL_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    })
    tokenRaw = await tokenRes.json().catch(() => null) ?? await tokenRes.text()

    if (tokenRes.ok && tokenRaw && typeof tokenRaw === 'object' && 'access_token' in tokenRaw) {
      token       = (tokenRaw as { access_token: string }).access_token
      tokenPreview = token.slice(0, 20) + '…'
    } else {
      authError = `HTTP ${tokenRes.status}`
    }
  } catch (e) {
    authError = String(e)
  }

  if (!token) {
    return NextResponse.json({
      auth: 'failed',
      error: authError,
      tokenResponse: tokenRaw,
    })
  }

  const authHeader = { Authorization: `Bearer ${token}` }

  // ── PASO 2: cotización bono AE38 ──────────────────────────────────────────
  let ae38: unknown = null
  try {
    const r = await fetch(`${IOL_BASE}/api/v2/bCBA/Titulos/AE38/Cotizacion`, {
      headers: authHeader,
    })
    ae38 = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e) {
    ae38 = { error: String(e) }
  }

  // ── PASO 3: cotización acción GGAL ────────────────────────────────────────
  let ggal: unknown = null
  try {
    const r = await fetch(`${IOL_BASE}/api/v2/bCBA/Titulos/GGAL/Cotizacion`, {
      headers: authHeader,
    })
    ggal = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e) {
    ggal = { error: String(e) }
  }

  // ── PASO 4: probar ruta v1 que mencionó el usuario ────────────────────────
  let ae38v1: unknown = null
  try {
    const r = await fetch(`${IOL_BASE}/api/v1/cotizaciones/bonos/AE38`, {
      headers: authHeader,
    })
    ae38v1 = { status: r.status, body: await r.json().catch(() => r.text()) }
  } catch (e) {
    ae38v1 = { error: String(e) }
  }

  return NextResponse.json({
    auth: 'ok',
    tokenPreview,
    ae38_v2: ae38,
    ggal_v2: ggal,
    ae38_v1: ae38v1,
  })
}
