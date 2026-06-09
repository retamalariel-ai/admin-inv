// Mapa de tickers de nuestra DB → ticker IOL (BCBA)
// Los bonos Globales (GD*) se llaman AE* en IOL/BYMA.
// Los Bonares (AL*) y acciones son iguales en ambos.
export const TICKER_MAP_TO_IOL: Record<string, string> = {
  // Bonos Globales USD (ARS) — GD* en DB, AE* en IOL
  GD29:  'AE29',
  GD30:  'AE30',
  GD35:  'AE35',
  GD38:  'AE38',
  GD41:  'AE41',
  GD46:  'AE46',

  // Bonos Globales USD (especie D — precio en USD)
  GD29D: 'AE29D',
  GD30D: 'GD30D', // GD30D permanece igual en IOL
  GD35D: 'AE35D',
  GD38D: 'AE38D',
  GD41D: 'AE41D',
  GD46D: 'AE46D',

  // Bonares ARS — igual en IOL
  AL29:  'AL29',
  AL30:  'AL30',
  AL35:  'AL35',
  AL41:  'AL41',

  // Bonares USD (especie D)
  AL30D: 'AL30D',
  AL35D: 'AL35D',
  AL41D: 'AL41D',

  // Acciones locales — iguales
  GGAL:  'GGAL',
  YPFD:  'YPFD',
  BMA:   'BMA',
  PAMP:  'PAMP',
  VIST:  'VIST',
  LOMA:  'LOMA',
  TXAR:  'TXAR',
  ALUA:  'ALUA',
  TECO2: 'TECO2',
  HARG:  'HARG',
  SUPV:  'SUPV',
  BBAR:  'BBAR',
  CRES:  'CRES',

  // CEDEARs — cotizan en BYMA en ARS
  MELI:  'MELI',
  XLU:   'XLU',
  IBIT:  'IBIT',
  YM34O: 'YM34O',
}

export function toIOLTicker(dbTicker: string): string {
  return TICKER_MAP_TO_IOL[dbTicker.toUpperCase()] ?? dbTicker.toUpperCase()
}

export function fromIOLTicker(iolTicker: string): string {
  const entry = Object.entries(TICKER_MAP_TO_IOL)
    .find(([, v]) => v === iolTicker.toUpperCase())
  return entry ? entry[0] : iolTicker.toUpperCase()
}
