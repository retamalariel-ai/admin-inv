const PPI_BASE = 'https://clientapi.portfoliopersonal.com/api'

const PPI_FIXED_HEADERS = {
  'AuthorizedClient': 'API_CLI_PYTHON',
  'ClientKey':        'pp19PythonApp12',
  'Content-Type':     'application/json',
}

interface PPIToken {
  accessToken:  string
  refreshToken: string
  obtainedAt:   number
  expiresInMs:  number
}

let cachedToken: PPIToken | null = null

export async function getPPIToken(): Promise<string> {
  const now = Date.now()

  if (
    cachedToken &&
    now - cachedToken.obtainedAt < cachedToken.expiresInMs - 60_000
  ) {
    return cachedToken.accessToken
  }

  const res = await fetch(`${PPI_BASE}/1.0/Account/LoginApi`, {
    method:  'POST',
    headers: {
      ...PPI_FIXED_HEADERS,
      'ApiKey':    process.env.PPI_API_KEY!,
      'ApiSecret': process.env.PPI_API_SECRET!,
    },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PPI auth failed: ${res.status} — ${text}`)
  }

  const data = await res.json()

  cachedToken = {
    accessToken:  data.accessToken,
    refreshToken: data.refreshToken,
    obtainedAt:   now,
    expiresInMs:  30 * 60 * 1000,
  }

  return cachedToken.accessToken
}

async function ppiFetch(path: string): Promise<unknown> {
  const token = await getPPIToken()
  const res = await fetch(`${PPI_BASE}${path}`, {
    headers: {
      ...PPI_FIXED_HEADERS,
      'ApiKey':        process.env.PPI_API_KEY!,
      'ApiSecret':     process.env.PPI_API_SECRET!,
      'Authorization': `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PPI API error: ${res.status} ${path} — ${text}`)
  }

  return res.json()
}

export type PPIInstrumentType = 'ACCIONES' | 'BONOS' | 'CEDEARS' | 'LETRAS' | 'ON'
export type PPISettlement     = 'INMEDIATA' | 'A-24HS' | 'A-48HS'

export interface PPIQuote {
  date:                string
  price:               number
  volume:              number
  openingPrice:        number
  max:                 number
  min:                 number
  previousClose:       number
  marketChange:        number
  marketChangePercent: string
}

export function assetTypeToPPI(assetType: string): PPIInstrumentType {
  switch (assetType) {
    case 'ACCION_LOCAL':     return 'ACCIONES'
    case 'CEDEAR':           return 'CEDEARS'
    case 'BONO_SOBERANO':
    case 'BONO_SUBSOBERANO': return 'BONOS'
    case 'ON':               return 'ON'
    case 'LETES':
    case 'LECAP':            return 'LETRAS'
    default:                 return 'ACCIONES'
  }
}

export async function getPPIQuote(
  ticker:     string,
  type:       PPIInstrumentType,
  settlement: PPISettlement = 'A-48HS',
): Promise<PPIQuote> {
  return ppiFetch(
    `/1.0/MarketData/Current?ticker=${ticker}&type=${type}&settlement=${settlement}`,
  ) as Promise<PPIQuote>
}

export async function getPPIQuotes(
  assets: Array<{ ticker: string; asset_type: string }>,
): Promise<Map<string, PPIQuote>> {
  const results = new Map<string, PPIQuote>()

  for (const asset of assets) {
    try {
      const type  = assetTypeToPPI(asset.asset_type)
      const quote = await getPPIQuote(asset.ticker, type)
      results.set(asset.ticker.toUpperCase(), quote)
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.warn(`PPI: no quote for ${asset.ticker}:`, e)
    }
  }

  return results
}

export async function calculateRatesFromPPI(): Promise<{
  mep:       number | null
  ccl:       number | null
  al30_ars:  number | null
  al30d_usd: number | null
  gd30_ars:  number | null
  gd30d_usd: number | null
}> {
  const [al30, al30d, gd30, gd30d] = await Promise.allSettled([
    getPPIQuote('AL30',  'BONOS', 'A-48HS'),
    getPPIQuote('AL30D', 'BONOS', 'A-48HS'),
    getPPIQuote('GD30',  'BONOS', 'A-48HS'),
    getPPIQuote('GD30D', 'BONOS', 'A-48HS'),
  ])

  const al30Price  = al30.status  === 'fulfilled' ? al30.value.price  : null
  const al30dPrice = al30d.status === 'fulfilled' ? al30d.value.price : null
  const gd30Price  = gd30.status  === 'fulfilled' ? gd30.value.price  : null
  const gd30dPrice = gd30d.status === 'fulfilled' ? gd30d.value.price : null

  const mep = al30Price && al30dPrice && al30dPrice > 0
    ? al30Price / al30dPrice
    : null

  const ccl = gd30Price && gd30dPrice && gd30dPrice > 0
    ? gd30Price / gd30dPrice
    : null

  return { mep, ccl, al30_ars: al30Price, al30d_usd: al30dPrice, gd30_ars: gd30Price, gd30d_usd: gd30dPrice }
}
