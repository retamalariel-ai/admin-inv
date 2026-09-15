// CAFCI (Cámara Argentina de Fondos Comunes de Inversión)
// Endpoint público: api.pub.cafci.org.ar/pb_get
// Formato actual: CSV separado por ; con encoding Latin-1, sin header.

const PUB_URL = 'https://api.pub.cafci.org.ar'

export interface CAFCIQuote {
  claseId:     number   // col 18 — ID único de la clase
  nombre:      string   // col 0  — nombre del fondo y clase
  vcp:         number   // col 5  — valor cuotaparte vigente
  vcpAnterior: number   // col 6  — VCP del día anterior
  fecha:       string   // col 4  — DD/MM/YY
  moneda:      string   // col 1  — ARS | USD
}

// Descarga el CSV público y devuelve un mapa claseId → CAFCIQuote
export async function getCAFCIQuotes(): Promise<Map<number, CAFCIQuote>> {
  const res = await fetch(`${PUB_URL}/pb_get?d=${Date.now()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
    next:    { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CAFCI pb_get ${res.status}`)

  const buffer  = await res.arrayBuffer()
  const csvStr  = new TextDecoder('latin1').decode(buffer)

  console.log('[cafci] content-type:', res.headers.get('content-type'))
  console.log('[cafci] primeros 200 chars:', csvStr.slice(0, 200))

  const result = parseCSV(csvStr)

  console.log('[cafci] total líneas parseadas:', result.size)
  console.log('[cafci] primeras 3 entradas:', [...result.entries()].slice(0, 3))

  return result
}

// ── Parser ─────────────────────────────────────────────────────────────────

// Columnas del CSV (0-indexed, separador ;):
//   0  = nombre fondo + clase
//   1  = moneda (ARS | USD)
//   4  = fecha VCP (DD/MM/YY)
//   5  = VCP vigente   (formato: punto miles, coma decimal — ej: 1.234,56)
//   6  = VCP anterior  (mismo formato)
//   18 = ID clase (entero — clave de búsqueda)
function parseCSV(csv: string): Map<number, CAFCIQuote> {
  const results = new Map<number, CAFCIQuote>()

  for (const rawLine of csv.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const cols = line.split(';')
    if (cols.length < 19) continue

    const claseId     = parseInt(cols[18], 10)
    const vcp         = parseNum(cols[5])
    const vcpAnterior = parseNum(cols[6])

    if (isNaN(claseId) || isNaN(vcp) || vcp <= 0) continue

    results.set(claseId, {
      claseId,
      nombre:      cols[0].trim(),
      vcp,
      vcpAnterior: isNaN(vcpAnterior) ? 0 : vcpAnterior,
      fecha:       cols[4].trim(),
      moneda:      cols[1].trim(),
    })
  }

  return results
}

// Convierte "1.234,56" → 1234.56
function parseNum(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'))
}
