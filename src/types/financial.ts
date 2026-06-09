import { Decimal } from 'decimal.js'

// Resultado del cálculo de P&L para una posición
export interface PnLResult {
  marketValueARS: Decimal
  marketValueUSD: Decimal
  costBasisARS: Decimal
  costBasisUSD: Decimal
  unrealizedPnLARS: Decimal
  unrealizedPnLUSD: Decimal
  unrealizedPnLARSPct: Decimal
  unrealizedPnLUSDPct: Decimal
  fxGainLossARS: Decimal      // Ganancia puramente cambiaria
  priceGainLossARS: Decimal   // Ganancia de precio pura (sin FX)
  realizedPnLARS: Decimal
  realizedPnLUSD: Decimal
  totalIncomeARS: Decimal
  totalIncomeUSD: Decimal
  totalReturnARS: Decimal     // unrealized + realized + income
  totalReturnUSD: Decimal
}

// Tipos de cambio actuales
export interface FXRates {
  mep: Decimal
  ccl: Decimal
  oficial: Decimal
  blue?: Decimal
  date: Date
}

// Resumen de AUM por portfolio
export interface PortfolioSummary {
  portfolioId: string
  portfolioName: string
  clientId: string
  clientName: string
  totalAUMars: Decimal
  totalAUMusd: Decimal
  totalUnrealizedPnLARS: Decimal
  totalUnrealizedPnLUSD: Decimal
  totalRealizedPnLARS: Decimal
  totalRealizedPnLUSD: Decimal
  totalReturnARS: Decimal
  totalReturnUSD: Decimal
  positionCount: number
}

// Resumen de AUM por cliente (agrupa todos sus portfolios)
export interface ClientSummary {
  clientId: string
  clientName: string
  totalAUMars: Decimal
  totalAUMusd: Decimal
  totalUnrealizedPnLARS: Decimal
  totalUnrealizedPnLUSD: Decimal
  totalReturnARS: Decimal
  totalReturnUSD: Decimal
  portfolioCount: number
}

// AUM total del administrador
export interface AdminAUMSummary {
  totalAUMars: Decimal
  totalAUMusd: Decimal
  totalClients: number
  totalPortfolios: number
  allocationByAssetType: Record<string, Decimal>
  allocationByCurrency: Record<string, Decimal>
}

// Posición valuada a mercado (fila de portfolio_valuation_unified)
export interface ValuatedPosition {
  portfolioId: string
  portfolioName: string
  custodianName: string
  clientId: string
  clientName: string
  assetId: string
  ticker: string
  assetName: string
  assetType: string
  assetCurrency: string
  currentResidualFactor: Decimal
  quantityHeld: Decimal
  quantityEffective: Decimal
  currentPrice: Decimal | null
  priceDate: Date | null
  fxMepToday: Decimal | null
  fxCclToday: Decimal | null
  pppARS: Decimal
  totalCostBasisARS: Decimal
  pppUSD: Decimal
  totalCostBasisUSD: Decimal
  avgFxMepAtCost: Decimal | null
  marketValueARS: Decimal
  marketValueUSD: Decimal
  unrealizedPnLARS: Decimal
  unrealizedPnLUSD: Decimal
  unrealizedPnLARSPct: Decimal
  fxGainLossARS: Decimal
  priceGainLossARS: Decimal
  realizedGainLossARS: Decimal
  realizedGainLossUSD: Decimal
  totalIncomeReceivedARS: Decimal
  totalIncomeReceivedUSD: Decimal
  totalReturnARS: Decimal
  totalReturnUSD: Decimal
  firstPurchaseDate: Date | null
  lastTransactionDate: Date | null
}
