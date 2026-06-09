const IOL_BASE = 'https://api.invertironline.com'

interface IOLTokenCache {
  accessToken:  string
  refreshToken: string
  expiresAt:    number // timestamp ms
}

let tokenCache: IOLTokenCache | null = null

export async function getIOLToken(): Promise<string> {
  const now = Date.now()

  // Token vigente (con 60s de margen)
  if (tokenCache && tokenCache.expiresAt - 60_000 > now) {
    return tokenCache.accessToken
  }

  // Intentar renovar con refresh token antes de re-login
  if (tokenCache?.refreshToken) {
    try {
      const res = await fetch(`${IOL_BASE}/token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          grant_type:    'refresh_token',
          refresh_token: tokenCache.refreshToken,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        tokenCache = {
          accessToken:  data.access_token,
          refreshToken: data.refresh_token ?? tokenCache.refreshToken,
          expiresAt:    now + data.expires_in * 1000,
        }
        return tokenCache.accessToken
      }
    } catch {
      console.warn('[IOL] refresh token failed, re-logging in')
    }
  }

  // Login fresco con usuario/password
  const res = await fetch(`${IOL_BASE}/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      username:   process.env.IOL_USERNAME!,
      password:   process.env.IOL_PASSWORD!,
      grant_type: 'password',
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IOL auth failed: ${res.status} ${body}`)
  }

  const data = await res.json()
  tokenCache = {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    now + data.expires_in * 1000,
  }
  return tokenCache.accessToken
}

async function iolFetch(path: string) {
  const token = await getIOLToken()
  const res   = await fetch(`${IOL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IOL API ${res.status} ${path}: ${body}`)
  }
  return res.json()
}

export interface IOLQuote {
  ultimoPrecio:        number
  variacion:           number
  apertura:            number
  maximo:              number
  minimo:              number
  cierreAnterior:      number
  moneda:              string
  lote:                number
  cantidadOperaciones: number
  fechaHora:           string
}

export async function getIOLQuote(ticker: string): Promise<IOLQuote> {
  return iolFetch(`/api/v2/bCBA/Titulos/${ticker}/Cotizacion`)
}

export async function getIOLQuotes(
  tickers: string[],
): Promise<Map<string, IOLQuote>> {
  const results = new Map<string, IOLQuote>()

  for (const ticker of tickers) {
    try {
      const quote = await getIOLQuote(ticker)
      results.set(ticker.toUpperCase(), quote)
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.warn(`[IOL] no quote for ${ticker}:`, e)
    }
  }

  return results
}

export interface IOLRates {
  mep:           number | null
  ccl:           number | null
  ccl_ticker_ars: string | null
  ccl_ticker_usd: string | null
}

export async function calculateRatesFromIOL(): Promise<IOLRates> {
  // MEP  = AL30_ARS / AL30D_USD  (Bonares, mismo ticker en IOL)
  // CCL  primario:  AE30_ARS  / GD30D_USD  (Global 2030)
  // CCL  fallback:  AE38_ARS  / AE38D_USD  (Global 2038 — mayor liquidez)
  const [al30, al30d, ae30, gd30d, ae38, ae38d] = await Promise.allSettled([
    getIOLQuote('AL30'),
    getIOLQuote('AL30D'),
    getIOLQuote('AE30'),
    getIOLQuote('GD30D'),
    getIOLQuote('AE38'),
    getIOLQuote('AE38D'),
  ])

  const p = (r: PromiseSettledResult<IOLQuote>) =>
    r.status === 'fulfilled' && r.value.ultimoPrecio > 0 ? r.value.ultimoPrecio : null

  const mep =
    p(al30) != null && p(al30d) != null
      ? p(al30)! / p(al30d)!
      : null

  let ccl:           number | null = null
  let ccl_ticker_ars: string | null = null
  let ccl_ticker_usd: string | null = null

  if (p(ae30) != null && p(gd30d) != null) {
    ccl            = p(ae30)! / p(gd30d)!
    ccl_ticker_ars = 'AE30'
    ccl_ticker_usd = 'GD30D'
  } else if (p(ae38) != null && p(ae38d) != null) {
    // AE38/AE38D como fallback — ambos en VN100, la proporción ARS/USD es idéntica
    ccl            = p(ae38)! / p(ae38d)!
    ccl_ticker_ars = 'AE38'
    ccl_ticker_usd = 'AE38D'
  }

  return { mep, ccl, ccl_ticker_ars, ccl_ticker_usd }
}
