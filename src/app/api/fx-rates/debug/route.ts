import { getIOLToken } from '@/lib/iol/client'

export const dynamic = 'force-dynamic'

const IOL_BASE = 'https://api.invertironline.com'

interface RawQuote {
  ultimoPrecio:    number
  cierreAnterior:  number
  moneda:          string
  fechaHora:       string
  puntasCompra?:   { precio: number; volumen: number }[]
  puntasVenta?:    { precio: number; volumen: number }[]
  [key: string]:   unknown
}

async function fetchRaw(ticker: string): Promise<RawQuote> {
  const token = await getIOLToken()
  const res   = await fetch(`${IOL_BASE}/api/v2/bCBA/Titulos/${ticker}/Cotizacion`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`IOL ${ticker} → ${res.status}: ${body}`)
  }
  return res.json()
}

function summarize(
  result: PromiseSettledResult<RawQuote>,
  ticker: string,
) {
  if (result.status === 'rejected') {
    return { ticker, error: String(result.reason) }
  }
  const q = result.value
  return {
    ticker,
    ultimoPrecio:   q.ultimoPrecio,
    cierreAnterior: q.cierreAnterior,
    moneda:         q.moneda,
    fechaHora:      q.fechaHora,
    mejorCompra:    q.puntasCompra?.[0] ?? null,
    mejorVenta:     q.puntasVenta?.[0]  ?? null,
    puntasCompra:   (q.puntasCompra ?? []).slice(0, 3),
    puntasVenta:    (q.puntasVenta  ?? []).slice(0, 3),
  }
}

function precio(r: PromiseSettledResult<RawQuote>): number | null {
  return r.status === 'fulfilled' && r.value.ultimoPrecio > 0
    ? r.value.ultimoPrecio
    : null
}

function mejorVenta(r: PromiseSettledResult<RawQuote>): number | null {
  if (r.status !== 'fulfilled') return null
  return r.value.puntasVenta?.[0]?.precio ?? null
}

function mejorCompra(r: PromiseSettledResult<RawQuote>): number | null {
  if (r.status !== 'fulfilled') return null
  return r.value.puntasCompra?.[0]?.precio ?? null
}

export async function GET() {
  const [al30, al30d, gd30, gd30d] = await Promise.allSettled([
    fetchRaw('AL30'),
    fetchRaw('AL30D'),
    fetchRaw('GD30'),
    fetchRaw('GD30D'),
  ])

  const p_al30  = precio(al30)
  const p_al30d = precio(al30d)
  const p_gd30  = precio(gd30)
  const p_gd30d = precio(gd30d)

  const mep_calculado =
    p_al30 != null && p_al30d != null ? p_al30 / p_al30d : null

  const ccl_calculado =
    p_gd30 != null && p_gd30d != null ? p_gd30 / p_gd30d : null

  // Alternativo: usar punta vendedora ARS / punta compradora USD
  // (precio al que realmente se puede operar el CCL)
  const gd30_pv  = mejorVenta(gd30)
  const gd30d_pc = mejorCompra(gd30d)
  const ccl_alternativo =
    gd30_pv != null && gd30d_pc != null ? gd30_pv / gd30d_pc : null

  return Response.json({
    timestamp: new Date().toISOString(),
    quotes: {
      AL30:  summarize(al30,  'AL30'),
      AL30D: summarize(al30d, 'AL30D'),
      GD30:  summarize(gd30,  'GD30'),
      GD30D: summarize(gd30d, 'GD30D'),
    },
    calculos: {
      mep_calculado,
      ccl_calculado,
      ccl_alternativo,
      nota: 'ccl_calculado = GD30.ultimoPrecio / GD30D.ultimoPrecio · ccl_alternativo = GD30.puntasVenta[0] / GD30D.puntasCompra[0]',
    },
  })
}
