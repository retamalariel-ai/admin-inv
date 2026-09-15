// CAFCI (Cámara Argentina de Fondos Comunes de Inversión)
// Endpoint público: api.pub.cafci.org.ar/pb_get — devuelve XLSX con VCPs diarios.
// Usamos SheetJS (xlsx) para parsear el workbook en server-side.

const PUB_URL = 'https://api.pub.cafci.org.ar'

export interface CAFCIQuote {
  claseId:     number   // col 20 (U) — ID único de la clase
  nombre:      string   // col 0  (A) — nombre del fondo y clase
  vcp:         number   // col 5  (F) — valor cuotaparte vigente
  vcpAnterior: number   // col 6  (G) — VCP del día anterior
  fecha:       string   // col 4  (E) — DD/MM/YY
  moneda:      string   // col 1  (B) — ARS | USD
}

// Descarga el XLSX público y devuelve un mapa claseId → CAFCIQuote
export async function getCAFCIQuotes(): Promise<Map<number, CAFCIQuote>> {
  const res = await fetch(`${PUB_URL}/pb_get`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`CAFCI fetch failed: ${res.status}`)

  const buffer = await res.arrayBuffer()

  // Dynamic import para compatibilidad con Next.js server-side bundling
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })

  const sheetName = workbook.SheetNames[0]
  const sheet     = workbook.Sheets[sheetName]

  // Array de arrays, raw:false para que los números lleguen como string formateado
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw:    false,
    defval: '',
  })

  console.log('[cafci] total filas:', rows.length)
  console.log('[cafci] primera fila:', rows[0])
  console.log('[cafci] segunda fila:', rows[1])

  const map = new Map<number, CAFCIQuote>()

  for (const row of rows) {
    const r = row as unknown[]

    // Col U = índice 20 (0-based)
    const claseId = parseInt(String(r[20] ?? ''), 10)
    if (isNaN(claseId) || claseId <= 0) continue

    const vcpRaw    = String(r[5] ?? '')
    const vcpAntRaw = String(r[6] ?? '')

    // SheetJS con raw:false puede devolver número directo o string con coma decimal
    const vcp         = parseNum(vcpRaw)
    const vcpAnterior = parseNum(vcpAntRaw)

    if (isNaN(vcp) || vcp <= 0) continue

    map.set(claseId, {
      claseId,
      nombre:      String(r[0] ?? '').trim(),
      vcp,
      vcpAnterior: isNaN(vcpAnterior) ? 0 : vcpAnterior,
      fecha:       String(r[4] ?? '').trim(),
      moneda:      String(r[1] ?? '').trim(),
    })
  }

  console.log('[cafci] total entradas parseadas:', map.size)

  // Verificar fondos Cocos conocidos
  for (const id of [4447, 5424, 2517, 5496]) {
    console.log(`[cafci] id ${id}:`, map.get(id))
  }

  return map
}

// Soporta "1.234,56", "1234.56" y número directo de SheetJS
function parseNum(raw: string): number {
  const cleaned = raw.replace(/\./g, '').replace(',', '.')
  return parseFloat(cleaned)
}
