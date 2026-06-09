import Decimal from 'decimal.js'
import type { FXRates, PnLResult, ValuatedPosition, AdminAUMSummary } from '@/types/financial'

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

// Calcula el dólar MEP implícito desde precios de un bono
// MEP = precio_bono_ARS / precio_bono_USD
export function calculateMEP(
  priceARS: Decimal,
  priceUSD: Decimal
): Decimal {
  if (priceUSD.isZero()) return new Decimal(0)
  return priceARS.div(priceUSD)
}

// Calcula el dólar CCL implícito desde precios de un bono GD
export function calculateCCL(
  priceARS: Decimal,
  priceUSD: Decimal
): Decimal {
  if (priceUSD.isZero()) return new Decimal(0)
  return priceARS.div(priceUSD)
}

// Calcula el CCL implícito desde un CEDEAR
// CCL = precio_CEDEAR_ARS / (precio_subyacente_USD * ratio)
export function calculateCCLFromCEDEAR(
  priceCEDEAR_ARS: Decimal,
  priceUnderlying_USD: Decimal,
  cedearRatio: Decimal
): Decimal {
  const denominator = priceUnderlying_USD.mul(cedearRatio)
  if (denominator.isZero()) return new Decimal(0)
  return priceCEDEAR_ARS.div(denominator)
}

// Calcula el P&L completo de una posición valuada
export function calculatePnL(position: ValuatedPosition): PnLResult {
  const unrealizedPnLARS = position.marketValueARS
    .minus(position.totalCostBasisARS)

  const unrealizedPnLUSD = position.marketValueUSD
    .minus(position.totalCostBasisUSD)

  const unrealizedPnLARSPct = position.totalCostBasisARS.isZero()
    ? new Decimal(0)
    : unrealizedPnLARS.div(position.totalCostBasisARS)

  const unrealizedPnLUSDPct = position.totalCostBasisUSD.isZero()
    ? new Decimal(0)
    : unrealizedPnLUSD.div(position.totalCostBasisUSD)

  // fxGain = costo_USD * (MEP_hoy - MEP_compra)
  const fxGainLossARS = position.avgFxMepAtCost && position.fxMepToday
    ? position.totalCostBasisUSD.mul(
        position.fxMepToday.minus(position.avgFxMepAtCost)
      )
    : new Decimal(0)

  const priceGainLossARS = unrealizedPnLARS.minus(fxGainLossARS)

  const totalReturnARS = unrealizedPnLARS
    .plus(position.realizedGainLossARS)
    .plus(position.totalIncomeReceivedARS)

  const totalReturnUSD = unrealizedPnLUSD
    .plus(position.realizedGainLossUSD)
    .plus(position.totalIncomeReceivedUSD)

  return {
    marketValueARS: position.marketValueARS,
    marketValueUSD: position.marketValueUSD,
    costBasisARS: position.totalCostBasisARS,
    costBasisUSD: position.totalCostBasisUSD,
    unrealizedPnLARS,
    unrealizedPnLUSD,
    unrealizedPnLARSPct,
    unrealizedPnLUSDPct,
    fxGainLossARS,
    priceGainLossARS,
    realizedPnLARS: position.realizedGainLossARS,
    realizedPnLUSD: position.realizedGainLossUSD,
    totalIncomeARS: position.totalIncomeReceivedARS,
    totalIncomeUSD: position.totalIncomeReceivedUSD,
    totalReturnARS,
    totalReturnUSD,
  }
}

// Calcula el AUM total del administrador agregando todas las posiciones
export function calculateAdminAUM(
  positions: ValuatedPosition[]
): AdminAUMSummary {
  const totalAUMars = positions.reduce(
    (sum, p) => sum.plus(p.marketValueARS),
    new Decimal(0)
  )

  const totalAUMusd = positions.reduce(
    (sum, p) => sum.plus(p.marketValueUSD),
    new Decimal(0)
  )

  const allocationByAssetType: Record<string, Decimal> = {}
  positions.forEach(p => {
    const current = allocationByAssetType[p.assetType] ?? new Decimal(0)
    allocationByAssetType[p.assetType] = current.plus(p.marketValueARS)
  })
  if (!totalAUMars.isZero()) {
    Object.keys(allocationByAssetType).forEach(key => {
      allocationByAssetType[key] = allocationByAssetType[key].div(totalAUMars)
    })
  }

  const allocationByCurrency: Record<string, Decimal> = {}
  positions.forEach(p => {
    const key = p.assetCurrency
    const current = allocationByCurrency[key] ?? new Decimal(0)
    allocationByCurrency[key] = current.plus(p.marketValueARS)
  })
  if (!totalAUMars.isZero()) {
    Object.keys(allocationByCurrency).forEach(key => {
      allocationByCurrency[key] = allocationByCurrency[key].div(totalAUMars)
    })
  }

  const clientIds = new Set(positions.map(p => p.clientId))
  const portfolioIds = new Set(positions.map(p => p.portfolioId))

  return {
    totalAUMars,
    totalAUMusd,
    totalClients: clientIds.size,
    totalPortfolios: portfolioIds.size,
    allocationByAssetType,
    allocationByCurrency,
  }
}

export function formatARS(value: Decimal): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value.toNumber())
}

export function formatUSD(value: Decimal): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value.toNumber())
}

export function formatPct(value: Decimal): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value.toNumber())
}

// Cantidad crypto: hasta 8 decimales, sin ceros finales
export function formatCrypto(value: Decimal): string {
  return value.toFixed(8).replace(/\.?0+$/, '')
}
