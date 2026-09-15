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

  let diagLogged = false

  for (const row of rows) {
    const r = row as unknown[]

    // Col U = índice 20 (0-based)
    const claseId = parseInt(String(r[20] ?? ''), 10)
    if (isNaN(claseId) || claseId <= 0) continue

    // Log de diagnóstico en la primera fila con claseId válido (fondo Cocos u otro)
    if (!diagLogged) {
      console.log('[cafci] fila muestra:', r[0], '| vcp raw:', r[5], '| tipo:', typeof r[5])
      diagLogged = true
    }

    // SheetJS con raw:false puede devolver el número ya parseado (number)
    // o un string en formato argentino "1.090,467". Detectar el tipo evita
    // que replace(/\./g, '') destruya el punto decimal de un JS number→string.
    const vcp         = toNum(r[5])
    const vcpAnterior = toNum(r[6])

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

// Si SheetJS ya devolvió un number, usarlo directamente.
// Si es string en formato argentino ("1.090,467"), eliminar puntos de miles
// y convertir coma decimal a punto antes de parseFloat.
function toNum(val: unknown): number {
  if (typeof val === 'number') return val
  const s = String(val ?? '').trim()
  return parseFloat(s.replace(/\./g, '').replace(',', '.'))
}
