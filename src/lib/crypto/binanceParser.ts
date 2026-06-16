// Binance Spot history CSV parser
// Supports EN columns (Date(UTC), Pair, Side, Executed, Amount, Fee)
// and ES columns (Tiempo, Par, Lado, Ejecutado, Cantidad, Tarifa)

export interface CryptoParsedRow {
  source:           'binance' | 'nexo' | 'safepal'
  date:             string          // ISO date YYYY-MM-DD
  time?:            string          // HH:MM:SS
  baseCoin:         string          // e.g. SOL
  quoteCoin:        string          // e.g. USDT
  side:             'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'EARN' | 'REWARD' | 'FEE' | 'OTHER'
  quantity:         number          // base coin amount (Ejecutado)
  price?:           number          // price per unit
  total?:           number          // quote coin amount (Cantidad)
  fee?:             number
  feeCoin?:         string
  usdEquivalent?:   number
  rawType:          string
  notes?:           string
  // Grouping metadata (set when multiple micro-txs are merged)
  mergedCount?:     number
}

// ── Column name aliases (EN + ES) ──────────────────────────────────────────
const COLUMN_ALIASES: Record<string, string> = {
  // English
  'date(utc)':          'date',
  'date':               'date',
  'time':               'date',
  'datetime':           'date',
  'pair':               'pair',
  'symbol':             'pair',
  'side':               'side',
  'type':               'side',
  'order type':         'side',
  'price':              'price',
  'order price':        'price',
  'avg trading price':  'price',
  'avgtrading price':   'price',
  'executed':           'executed',
  'filled':             'executed',
  'order amount':       'executed',
  'amount':             'amount',
  'total':              'total',
  'fee':                'fee',
  'trading fee':        'fee',
  'gas fee':            'fee',
  'fee coin':           'feecoin',
  'fee asset':          'feecoin',
  // Spanish (Argentina)
  'tiempo':             'date',
  'par':                'pair',
  'lado':               'side',
  'precio':             'price',
  'ejecutado':          'executed',
  'cantidad':           'amount',
  'tarifa':             'fee',
}

// ── Quote coins for pair splitting ─────────────────────────────────────────
const QUOTE_COINS = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'ARS']

export function extractBaseCoin(pair: string): { base: string; quote: string } {
  for (const q of QUOTE_COINS) {
    if (pair.endsWith(q)) {
      return { base: pair.slice(0, -q.length), quote: q }
    }
  }
  const slash = pair.indexOf('/')
  if (slash > 0) return { base: pair.slice(0, slash), quote: pair.slice(slash + 1) }
  const dash = pair.indexOf('-')
  if (dash > 0) return { base: pair.slice(0, dash), quote: pair.slice(dash + 1) }
  return { base: pair, quote: 'USDT' }
}

// Parses "5.36SOL" → { num: 5.36, coin: "SOL" }
// Also handles plain "400.1776" → { num: 400.1776, coin: "" }
function extractNumericAndCoin(raw: string): { num: number; coin: string } {
  const match = raw.trim().match(/^([0-9.,]+)\s*([A-Za-z]*)$/)
  if (!match) return { num: parseFloat(raw) || 0, coin: '' }
  const num  = parseFloat(match[1].replace(',', '.')) || 0
  const coin = match[2].toUpperCase()
  return { num, coin }
}

function parseDate(raw: string): { date: string; time: string } {
  const normalized = raw.trim().replace('T', ' ')
  const [datePart = '', timePart = ''] = normalized.split(' ')
  return { date: datePart, time: timePart }
}

// ── Parse raw rows (before grouping) ──────────────────────────────────────
function parseRawRows(csvText: string): {
  raw:    CryptoParsedRow[]
  errors: string[]
  sep:    string
} {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { raw: [], errors: ['Archivo vacío o sin datos'], sep: ',' }

  const errors: string[] = []
  const raw:    CryptoParsedRow[] = []

  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ','

  const headerLine = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase())

  // Build logical-name → column-index map using COLUMN_ALIASES
  const colIdx: Record<string, number> = {}
  for (let i = 0; i < headerLine.length; i++) {
    const alias = COLUMN_ALIASES[headerLine[i]]
    if (alias && !(alias in colIdx)) {
      colIdx[alias] = i
    }
  }

  if (!('date' in colIdx) || !('pair' in colIdx)) {
    return {
      raw:    [],
      errors: ['Formato no reconocido — se necesita columna de fecha (Tiempo/Date) y par (Par/Pair)'],
      sep,
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.replace(/"/g, '').trim())
    if (cells.length < 3) continue

    try {
      const rawDate = cells[colIdx['date'] ?? -1] ?? ''
      const rawPair = cells[colIdx['pair'] ?? -1] ?? ''
      const rawSide = (cells[colIdx['side'] ?? -1] ?? '').toUpperCase()

      if (!rawDate || !rawPair) continue

      const { date, time } = parseDate(rawDate)
      const { base, quote } = extractBaseCoin(rawPair)

      // Executed = quantity in base coin (may include coin symbol e.g. "5.36SOL")
      const executedStr = 'executed' in colIdx ? (cells[colIdx['executed']] ?? '0') : '0'
      const { num: numExecuted } = extractNumericAndCoin(executedStr)

      // Amount = total in quote coin (may include coin symbol e.g. "400.1776USDT")
      const amountStr = 'amount' in colIdx ? (cells[colIdx['amount']] ?? '') : ''
      const { num: numAmount } = extractNumericAndCoin(amountStr)

      // Price
      const priceStr = 'price' in colIdx ? (cells[colIdx['price']] ?? '') : ''
      const numPrice = priceStr ? parseFloat(priceStr.replace(',', '.')) : undefined

      // Total (explicit column if present)
      const totalStr = 'total' in colIdx ? (cells[colIdx['total']] ?? '') : ''
      const numTotal = totalStr ? parseFloat(totalStr.replace(',', '.')) : undefined

      // Fee: parse number + embedded coin symbol
      const feeStr = 'fee' in colIdx ? (cells[colIdx['fee']] ?? '') : ''
      const { num: numFee, coin: feeCoinFromVal } = extractNumericAndCoin(feeStr)

      // FeeCoin from dedicated column takes priority; fall back to embedded coin in fee value
      const feeCoinFromCol = 'feecoin' in colIdx ? (cells[colIdx['feecoin']] ?? '') : ''
      const feeCoin = feeCoinFromCol || feeCoinFromVal || undefined

      let side: CryptoParsedRow['side'] = 'OTHER'
      if (rawSide.includes('BUY'))  side = 'BUY'
      if (rawSide.includes('SELL')) side = 'SELL'

      // Use explicit total column, then computed from amount column, then qty*price
      const resolvedTotal =
        (numTotal   != null && !isNaN(numTotal)  && numTotal  > 0) ? numTotal  :
        (numAmount  > 0)                                             ? numAmount :
        (numExecuted > 0 && numPrice != null)                        ? numExecuted * numPrice! :
        undefined

      raw.push({
        source:    'binance',
        date,
        time:      time || undefined,
        baseCoin:  base,
        quoteCoin: quote,
        side,
        quantity:  isNaN(numExecuted) ? 0 : numExecuted,
        price:     numPrice != null && !isNaN(numPrice) ? numPrice : undefined,
        total:     resolvedTotal,
        fee:       !isNaN(numFee) ? numFee : undefined,
        feeCoin,
        rawType:   rawSide,
      })
    } catch {
      errors.push(`Línea ${i + 1}: error al parsear`)
    }
  }

  return { raw, errors, sep }
}

// ── Grouping key: same pair + same second → merge micro-transactions ───────
function groupKey(r: CryptoParsedRow): string {
  const t = r.time ?? ''
  return `${r.baseCoin}/${r.quoteCoin}|${r.date}|${t}|${r.side}`
}

function mergeGroup(rows: CryptoParsedRow[]): CryptoParsedRow {
  if (rows.length === 1) return rows[0]

  const totalQty = rows.reduce((s, r) => s + r.quantity, 0)
  // Weighted average price
  const wavgPrice = rows.every(r => r.price != null)
    ? rows.reduce((s, r) => s + r.price! * r.quantity, 0) / (totalQty || 1)
    : rows[0].price
  const totalAmt = rows.reduce((s, r) => s + (r.total ?? 0), 0)
  const totalFee = rows.reduce((s, r) => s + (r.fee ?? 0), 0)

  return {
    ...rows[0],
    quantity:     totalQty,
    price:        wavgPrice,
    total:        totalAmt || undefined,
    fee:          totalFee || undefined,
    mergedCount:  rows.length,
  }
}

// ── Main export ─────────────────────────────────────────────────────────────
export interface BinanceSummaryEntry {
  baseCoin:  string
  quoteCoin: string
  buyCount:  number
  sellCount: number
  buyQty:    number
  sellQty:   number
  netQty:    number          // positive = net buy, negative = net sell
}

export function parseBinanceCSV(csvText: string): {
  rows:    CryptoParsedRow[]
  summary: BinanceSummaryEntry[]
  errors:  string[]
} {
  const { raw, errors } = parseRawRows(csvText)

  // Group micro-transactions (same pair, same second)
  const grouped = new Map<string, CryptoParsedRow[]>()
  for (const r of raw) {
    const k = groupKey(r)
    const bucket = grouped.get(k)
    if (bucket) bucket.push(r)
    else grouped.set(k, [r])
  }

  const rows = Array.from(grouped.values()).map(mergeGroup)

  // Build per-coin summary
  const summaryMap = new Map<string, BinanceSummaryEntry>()
  for (const r of rows) {
    const key  = r.baseCoin
    const prev = summaryMap.get(key) ?? {
      baseCoin:  r.baseCoin,
      quoteCoin: r.quoteCoin,
      buyCount: 0, sellCount: 0,
      buyQty: 0,  sellQty: 0,  netQty: 0,
    }
    if (r.side === 'BUY') {
      prev.buyCount++
      prev.buyQty += r.quantity
    } else if (r.side === 'SELL') {
      prev.sellCount++
      prev.sellQty += r.quantity
    }
    prev.netQty = prev.buyQty - prev.sellQty
    summaryMap.set(key, prev)
  }

  const summary = Array.from(summaryMap.values()).sort((a, b) =>
    (b.buyCount + b.sellCount) - (a.buyCount + a.sellCount)
  )

  return { rows, summary, errors }
}
