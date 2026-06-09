// CAFCI (Cámara Argentina de Fondos Comunes de Inversión)
// La API autenticada (api.cafci.org.ar) requiere Bearer token no-público.
// Usamos el endpoint público api.pub.cafci.org.ar/pb_get que devuelve un XLSX
// con el VCP (valor cuotaparte) vigente de todos los fondos.

import { inflateRawSync } from 'zlib'

const PUB_URL = 'https://api.pub.cafci.org.ar'

export interface CAFCIQuote {
  claseId:     number   // columna U — ID único de la clase
  nombre:      string   // nombre del fondo y clase
  vcp:         number   // valor cuotaparte vigente (F)
  vcpAnterior: number   // VCP del día anterior (G)
  fecha:       string   // DD/MM/YY (E)
  moneda:      string   // ARS | USD (B)
}

// Descarga el XLSX público y devuelve un mapa claseId → CAFCIQuote
export async function getCAFCIQuotes(): Promise<Map<number, CAFCIQuote>> {
  const res = await fetch(`${PUB_URL}/pb_get?d=${Date.now()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
    next:    { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`CAFCI pb_get ${res.status}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const xmlStr = extractSheetXml(buffer)
  if (!xmlStr) throw new Error('CAFCI: no se pudo extraer sheet1.xml')

  return parseSheet(xmlStr)
}

// ── Parser ─────────────────────────────────────────────────────────────────

// Columnas relevantes del Excel (fijas en el formato actual de CAFCI):
//   A = nombre fondo + clase  (inline string)
//   B = moneda (ARS | USD)    (inline string)
//   E = fecha VCP             (inline string, formato DD/MM/YY)
//   F = VCP vigente           (número)
//   G = VCP anterior          (número)
//   U = ID clase              (número — clave de búsqueda)
function parseSheet(xmlStr: string): Map<number, CAFCIQuote> {
  const results = new Map<number, CAFCIQuote>()

  const rowRe = /<row[^>]+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let m: RegExpExecArray | null

  while ((m = rowRe.exec(xmlStr)) !== null) {
    const cells = extractCells(m[2])

    const nombre   = cells['A'] ?? ''
    const moneda   = cells['B'] ?? ''
    const fecha    = cells['E'] ?? ''
    const vcp      = parseFloat(cells['F'] ?? '')
    const vcpAnt   = parseFloat(cells['G'] ?? '0')
    const claseId  = parseInt(cells['U'] ?? '', 10)

    if (!nombre || isNaN(claseId) || isNaN(vcp) || vcp <= 0) continue
    results.set(claseId, { claseId, nombre, vcp, vcpAnterior: isNaN(vcpAnt) ? 0 : vcpAnt, fecha, moneda })
  }

  return results
}

function extractCells(rowContent: string): Record<string, string> {
  const cells: Record<string, string> = {}
  let m: RegExpExecArray | null

  // inline strings: <c r="A1" t="inlineStr"><is><t>…</t></is></c>
  const inRe = /<c r="([A-Z]+)\d+"[^>]*t="inlineStr"[^>]*>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/g
  while ((m = inRe.exec(rowContent)) !== null) cells[m[1]] = m[2].trim()

  // numéricos: <c r="F1"><v>1060.769</v></c>
  const numRe = /<c r="([A-Z]+)\d+"(?![^>]*t=)[^>]*><v>([\s\S]*?)<\/v>/g
  while ((m = numRe.exec(rowContent)) !== null) if (!cells[m[1]]) cells[m[1]] = m[2].trim()

  return cells
}

// ── ZIP parser (extrae sheet1.xml del XLSX) ───────────────────────────────

const TARGET = 'xl/worksheets/sheet1.xml'

function extractSheetXml(zip: Buffer): string | null {
  let offset = 0

  while (offset < zip.length - 30) {
    // Firma de Local File Header: PK\x03\x04
    if (zip.readUInt32LE(offset) !== 0x04034b50) {
      offset++
      continue
    }

    const compression = zip.readUInt16LE(offset + 8)
    const compSize    = zip.readUInt32LE(offset + 18)
    const uncompSize  = zip.readUInt32LE(offset + 22)
    const fnLen       = zip.readUInt16LE(offset + 26)
    const extraLen    = zip.readUInt16LE(offset + 28)
    const headerEnd   = offset + 30 + fnLen + extraLen
    const fn          = zip.toString('utf8', offset + 30, offset + 30 + fnLen)

    if (fn === TARGET) {
      const data = zip.slice(headerEnd, headerEnd + compSize)
      if (compression === 0) return data.toString('utf8')
      if (compression === 8) return inflateRawSync(data).toString('utf8')
      return null
    }

    offset = headerEnd + compSize
  }

  return null
}
