-- =============================================================================
-- MIGRACIÓN 004: Índices de performance
-- Orden de ejecución: 4 de 7
-- Descripción: Crea todos los índices necesarios para las queries frecuentes
--              del dashboard, recálculo de posiciones y auditoría blockchain.
--              Incluye los índices parciales de price_quotes que reemplazan
--              el UNIQUE constraint omitido en 003 (NULL en quote_time).
-- Requisito previo: 001_enums.sql, 002_tables_base.sql, 003_tables_dependent.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- ÍNDICES DE transactions
-- Son los más críticos: recalculate_position() los usa en cada INSERT.
-- Todos los índices de uso operacional filtran WHERE is_cancelled = FALSE
-- para excluir registros anulados sin necesidad de filtrar en cada query.
-- =============================================================================

-- Filtro principal del dashboard: todas las operaciones vigentes de un portfolio
-- ordenadas cronológicamente invertido (más recientes primero)
CREATE INDEX idx_tx_portfolio_date
  ON public.transactions (portfolio_id, trade_date DESC)
  WHERE is_cancelled = FALSE;

-- Usado por recalculate_position(): itera operaciones de un portfolio/activo
-- en orden cronológico estricto (trade_date ASC, created_at ASC como desempate)
CREATE INDEX idx_tx_portfolio_asset_date
  ON public.transactions (portfolio_id, asset_id, trade_date ASC, created_at ASC)
  WHERE is_cancelled = FALSE;

-- Auditoría blockchain: buscar una transacción por su hash on-chain
CREATE INDEX idx_tx_hash
  ON public.transactions (tx_hash)
  WHERE tx_hash IS NOT NULL;

-- Rastreo de anulaciones: encontrar qué registro cancela a cuál
CREATE INDEX idx_tx_cancels
  ON public.transactions (cancels_transaction_id)
  WHERE cancels_transaction_id IS NOT NULL;

-- Trigger after_transaction_insert: necesita recalcular la posición
-- del activo destino en un SWAP_CRYPTO
CREATE INDEX idx_tx_swap_to_asset
  ON public.transactions (swap_to_asset_id)
  WHERE swap_to_asset_id IS NOT NULL;

-- =============================================================================
-- ÍNDICES DE positions
-- =============================================================================

-- Query más frecuente del dashboard: todas las posiciones de un portfolio
CREATE INDEX idx_pos_portfolio
  ON public.positions (portfolio_id);

-- Joins desde assets hacia positions (ej: vista de detalle de un instrumento)
CREATE INDEX idx_pos_asset
  ON public.positions (asset_id);

-- =============================================================================
-- ÍNDICES DE price_quotes
-- Los dos primeros son UNIQUE parciales que reemplazan el constraint omitido
-- en 003: un UNIQUE estándar trataría dos NULLs como distintos, permitiendo
-- duplicados en cotizaciones de cierre (quote_time IS NULL).
-- =============================================================================

-- Unicidad para cotizaciones intraday (quote_time NOT NULL)
CREATE UNIQUE INDEX uq_price_quotes_intraday
  ON public.price_quotes (asset_id, quote_date, quote_time, source)
  WHERE quote_time IS NOT NULL;

-- Unicidad para cierres diarios (quote_time IS NULL)
CREATE UNIQUE INDEX uq_price_quotes_closing
  ON public.price_quotes (asset_id, quote_date, source)
  WHERE quote_time IS NULL;

-- Obtener el precio más reciente de un activo: query más frecuente
-- en portfolio_valuation_unified (DISTINCT ON en 006_views.sql)
CREATE INDEX idx_quotes_asset_date_desc
  ON public.price_quotes (asset_id, quote_date DESC, quote_time DESC NULLS LAST);

-- =============================================================================
-- ÍNDICES DE fx_rates
-- =============================================================================

-- Lookup del tipo de cambio vigente para una fecha dada (P&L histórico)
CREATE INDEX idx_fx_date_desc
  ON public.fx_rates (rate_date DESC, rate_time DESC NULLS LAST);

-- =============================================================================
-- ÍNDICES DE portfolios
-- =============================================================================

-- Todos los portfolios activos de un cliente (sidebar de navegación)
CREATE INDEX idx_portfolios_client
  ON public.portfolios (client_id)
  WHERE is_active = TRUE;

-- =============================================================================
-- ÍNDICES DE asset_residual_history
-- =============================================================================

-- Reconstruir el factor residual de un bono en cualquier fecha pasada:
-- se usa ORDER BY event_date DESC con LIMIT 1 para obtener el último
-- factor previo a una fecha dada
CREATE INDEX idx_residual_history_asset_date
  ON public.asset_residual_history (asset_id, event_date DESC);
