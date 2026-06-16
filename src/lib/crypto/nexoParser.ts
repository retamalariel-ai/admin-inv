// Nexo CSV parser
// Columns: Transaction, Currency, Amount, USD Equivalent, Details, Date / Time

import type { CryptoParsedRow } from './binanceParser'

const NEXO_TYPE_MAP: Record<string, CryptoParsedRow['side']> = {
  'interest':            'EARN',
  'interest in nexo':    'EARN',
  'fixed term interest': 'EARN',
  'exchange':            'BUY',
  'exchange cashback':   'EARN',
  'deposit':             'TRANSFER_IN',
  'withdrawal':          'TRANSFER_OUT',
  'top up crypto':       'TRANSFER_IN',
  'withdrawal to external wallet': 'TRANSFER_OUT',
  'dividend':            'REWARD',
  'referral bonus':      'REWARD',
  'approved':            'OTHER',
  'rejected':            'OTHER',
  'unlocking term deposit': 'OTHER',
  'locking term deposit':   'OTHER',
}

function mapNexoType(raw: string): CryptoParsedRow['side'] {
  const key = raw.toLowerCase().trim()
  return NEXO_TYPE_MAP[key] ?? 'OTHER'
}

function parseNexoDate(raw: string): { date: string; time: string } {
  // Formats: "2023-01-15 10:30:00" or "2023-01-15T10:30:00 UTC"
  const cleaned = raw.trim().replace(' UTC', '').replace('T', ' ')
  const [datePart = '', timePart = ''] = cleaned.split(' ')
  return { date: datePart, time: timePart }
}

export function parseNexoCSV(csvText: string): { rows: CryptoParsedRow[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], errors: ['Archivo vacío o sin datos'] }

  const errors: string[] = []
  const rows:   CryptoParsedRow[] = []

  // Auto-detect separator
  const sep = lines[0].includes(';') ? ';' : ','

  const headers = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())

  const idx = (names: string[]) => {
    for (const name of names) {
      const i = headers.indexOf(name)
      if (i >= 0) return i
    }
    return -1
  }

  const idxType    = idx(['transaction', 'type', 'transaction type'])
  const idxCoin    = idx(['currency', 'coin', 'asset'])
  const idxAmount  = idx(['amount'])
  const idxUSD     = idx(['usd equivalent', 'usd value', 'usd amount'])
  const idxDetails = idx(['details', 'note', 'description'])
  const idxDate    = idx(['date / time', 'date/time', 'date', 'datetime', 'time'])

  if (idxDate < 0 || idxCoin < 0) {
    return { rows: [], errors: ['Formato Nexo no reconocido — columnas Date y Currency requeridas'] }
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.replace(/"/g, '').trim())
    if (cells.length < 3) continue

    try {
      const rawType    = idxType    >= 0 ? (cells[idxType]    ?? '') : ''
      const rawCoin    = idxCoin    >= 0 ? (cells[idxCoin]    ?? '') : ''
      const rawAmount  = idxAmount  >= 0 ? (cells[idxAmount]  ?? '0') : '0'
      const rawUSD     = idxUSD     >= 0 ? (cells[idxUSD]     ?? '') : ''
      const rawDetails = idxDetails >= 0 ? (cells[idxDetails] ?? '') : ''
      const rawDate    = idxDate    >= 0 ? (cells[idxDate]    ?? '') : ''

      if (!rawDate || !rawCoin) continue

      const { date, time } = parseNexoDate(rawDate)
      const numAmount = parseFloat(rawAmount.replace(',', '.'))
      const numUSD    = rawUSD ? parseFloat(rawUSD.replace(/[$,]/g, '')) : undefined
      const quantity  = Math.abs(isNaN(numAmount) ? 0 : numAmount)
      const side      = mapNexoType(rawType)

      // Nexo can have negative amounts for fees/withdrawals
      const effectiveSide: CryptoParsedRow['side'] =
        side === 'OTHER' && numAmount < 0 ? 'TRANSFER_OUT' : side

      rows.push({
        source:        'nexo',
        date,
        time:          time || undefined,
        baseCoin:      rawCoin.replace(/nexo/i, 'NEXO').toUpperCase(),
        quoteCoin:     'USD',
        side:          effectiveSide,
        quantity,
        usdEquivalent: numUSD != null && !isNaN(numUSD) ? numUSD : undefined,
        rawType,
        notes:         rawDetails || undefined,
      })
    } catch {
      errors.push(`Línea ${i + 1}: error al parsear`)
    }
  }

  return { rows, errors }
}
