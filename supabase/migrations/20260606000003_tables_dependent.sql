-- =============================================================================
-- MIGRACIÓN 003: Tablas dependientes del catálogo base
-- Orden de ejecución: 3 de 7
-- Descripción: Crea asset_residual_history (log de amortizaciones),
--              portfolios (cuentas por custodio), transactions (log inmutable),
--              positions (posición acumulada por activo) y price_quotes
--              (cotizaciones históricas de precios).
-- Requisito previo: 001_enums.sql, 002_tables_base.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- TABLA: asset_residual_history
-- Log inmutable de cada evento que modificó el factor residual de un activo.
-- Permite reconstruir el residual de cualquier bono en cualquier fecha pasada.
-- =============================================================================
CREATE TABLE public.asset_residual_history (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id            UUID             NOT NULL REFERENCES public.assets(id),
  event_date          DATE             NOT NULL,
  previous_factor     DECIMAL(10,8)    NOT NULL
                      CHECK (previous_factor >= 0 AND previous_factor <= 1),
  new_factor          DECIMAL(10,8)    NOT NULL
                      CHECK (new_factor >= 0 AND new_factor <= 1),
  amortization_pct    DECIMAL(8,6)     NOT NULL CHECK (amortization_pct > 0),
  payment_per_vn      DECIMAL(20,8)    NOT NULL CHECK (payment_per_vn > 0),
  settlement_currency public.currency  NOT NULL,
  source              TEXT             NOT NULL DEFAULT 'MANUAL',
  notes               TEXT,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.asset_residual_history                   IS 'Log inmutable de eventos de amortización de capital por activo';
COMMENT ON COLUMN public.asset_residual_history.previous_factor   IS 'Factor residual antes del evento (ej: 0.75000000)';
COMMENT ON COLUMN public.asset_residual_history.new_factor        IS '0.00000000 indica instrumento totalmente amortizado';
COMMENT ON COLUMN public.asset_residual_history.amortization_pct  IS 'Porcentaje del VN amortizado en este pago (ej: 0.250000 = 25%)';
COMMENT ON COLUMN public.asset_residual_history.payment_per_vn    IS 'Monto cobrado por cada unidad de VN original en settlement_currency';

-- =============================================================================
-- TABLA: portfolios
-- Una cuenta o "bolsillo" de inversión de un cliente en un custodio específico.
-- Un cliente puede tener múltiples portfolios (ej: cuenta Balanz + wallet MetaMask).
-- =============================================================================
CREATE TABLE public.portfolios (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID             NOT NULL REFERENCES public.clients(id),
  name               TEXT             NOT NULL,
  description        TEXT,
  base_currency      public.currency  NOT NULL DEFAULT 'ARS',
  custodian_type     TEXT             NOT NULL
                     CHECK (custodian_type IN (
                       'ALYCE',           -- Agente de Liquidación y Compensación (ej: Balanz, IOL)
                       'EXCHANGE_CEX',    -- Exchange centralizado (ej: Binance, Bitso, Lemon)
                       'WALLET_HW',       -- Hardware wallet (ej: Ledger, Trezor)
                       'WALLET_SW',       -- Software wallet (ej: MetaMask, Phantom)
                       'DEFI_PROTOCOL',   -- Protocolo DeFi autónomo
                       'EARN_PLATFORM',   -- Plataforma de rendimientos (ej: Nexo)
                       'OTRO'
                     )),
  custodian_name     TEXT             NOT NULL,
  account_identifier TEXT,            -- Nro. de cuenta, dirección de wallet, email de exchange
  blockchain_network TEXT,            -- Solo para wallets y DeFi (ej: 'ethereum', 'solana')
  is_active          BOOLEAN          NOT NULL DEFAULT TRUE,
  inception_date     DATE             NOT NULL DEFAULT CURRENT_DATE,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_portfolios_client_name UNIQUE (client_id, name)
);

-- set_updated_at() ya existe desde 002_tables_base.sql, no se re-crea
CREATE TRIGGER trg_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.portfolios                     IS 'Cuenta de inversión de un cliente en un custodio específico';
COMMENT ON COLUMN public.portfolios.custodian_type      IS 'Categoría del custodio que mantiene los activos';
COMMENT ON COLUMN public.portfolios.account_identifier  IS 'Identificador en el custodio: nro. de cuenta, dirección wallet, email de exchange';
COMMENT ON COLUMN public.portfolios.blockchain_network  IS 'Red blockchain (solo aplica para WALLET_* y DEFI_PROTOCOL)';

-- =============================================================================
-- TABLA: transactions
-- Log INMUTABLE de todas las operaciones financieras.
-- REGLA: nunca hacer UPDATE ni DELETE sobre esta tabla.
-- El único mecanismo de anulación es marcar is_cancelled = TRUE e insertar
-- un nuevo registro correctivo que referencie al original en cancels_transaction_id.
-- =============================================================================
CREATE TABLE public.transactions (
  id                       UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id             UUID                    NOT NULL REFERENCES public.portfolios(id),
  asset_id                 UUID                    REFERENCES public.assets(id),      -- NULL para cash puro
  transaction_type         public.transaction_type NOT NULL,
  trade_date               DATE                    NOT NULL,
  settlement_date          DATE,                                -- Fecha de acreditación (T+1, T+2, etc.)

  -- Cantidades y precios
  quantity                 DECIMAL(36,18)          NOT NULL CHECK (quantity > 0),
  price_per_unit           DECIMAL(20,8)           NOT NULL CHECK (price_per_unit >= 0),
  gross_amount             DECIMAL(20,4)           NOT NULL CHECK (gross_amount >= 0),
  alyce_commission         DECIMAL(20,4)           NOT NULL DEFAULT 0 CHECK (alyce_commission >= 0),
  gas_fee_amount           DECIMAL(20,8)           NOT NULL DEFAULT 0 CHECK (gas_fee_amount >= 0),
  gas_fee_currency         public.currency,
  other_fees               DECIMAL(20,4)           NOT NULL DEFAULT 0 CHECK (other_fees >= 0),
  net_amount               DECIMAL(20,4)           NOT NULL,   -- Sin CHECK: la lógica de negocio valida el signo
  currency                 public.currency         NOT NULL,

  -- Snapshot de tipos de cambio al momento de la operación.
  -- Se guardan acá para que el P&L histórico sea exacto e independiente
  -- de cambios futuros en la tabla fx_rates.
  fx_rate_mep              DECIMAL(20,8),           -- ARS/USD MEP vigente en trade_date
  fx_rate_ccl              DECIMAL(20,8),           -- ARS/USD CCL vigente en trade_date
  fx_rate_oficial          DECIMAL(20,8),           -- ARS/USD oficial vigente en trade_date
  crypto_price_usd         DECIMAL(20,8),           -- Precio del cripto en USD (para P&L bimoneda)

  -- Swap cripto-cripto: un solo registro bilateral (activo saliente = asset_id)
  swap_to_asset_id         UUID                    REFERENCES public.assets(id),
  swap_to_quantity         DECIMAL(36,18),
  swap_to_price_usd        DECIMAL(20,8),

  -- Auditoría blockchain y DeFi
  tx_hash                  TEXT,                    -- Hash de transacción on-chain
  protocol_name            TEXT,                    -- Protocolo DeFi (ej: 'Uniswap V3', 'Aave V3', 'Lido')
  pool_address             TEXT,                    -- Dirección del contrato del pool o vault

  -- Factor residual del bono vigente en trade_date (necesario para valuación histórica)
  residual_factor_at_trade DECIMAL(10,8)           NOT NULL DEFAULT 1.00000000,

  notes                    TEXT,

  -- Anulación lógica: único mecanismo para "deshacer" un registro
  is_cancelled             BOOLEAN                 NOT NULL DEFAULT FALSE,
  cancelled_at             TIMESTAMPTZ,
  cancellation_reason      TEXT,
  cancels_transaction_id   UUID                    REFERENCES public.transactions(id),

  created_at               TIMESTAMPTZ             NOT NULL DEFAULT NOW()
  -- SIN updated_at: log inmutable; las correcciones se insertan como nuevas filas
);

COMMENT ON TABLE  public.transactions                           IS 'Log inmutable de operaciones. Nunca UPDATE ni DELETE; anular con is_cancelled.';
COMMENT ON COLUMN public.transactions.asset_id                  IS 'NULL para movimientos de cash sin instrumento (ej: depósito bancario)';
COMMENT ON COLUMN public.transactions.quantity                  IS 'DECIMAL(36,18) para soportar precisión wei-level en cripto';
COMMENT ON COLUMN public.transactions.net_amount                IS 'Monto neto de la operación; signo validado por lógica de negocio, no por constraint';
COMMENT ON COLUMN public.transactions.fx_rate_mep               IS 'Snapshot del MEP en trade_date; necesario para P&L histórico exacto';
COMMENT ON COLUMN public.transactions.crypto_price_usd          IS 'Precio USD del cripto en el momento; permite calcular P&L en ARS y USD';
COMMENT ON COLUMN public.transactions.residual_factor_at_trade  IS 'Factor residual vigente del bono en trade_date';
COMMENT ON COLUMN public.transactions.swap_to_asset_id          IS 'En SWAP_CRYPTO: activo recibido; asset_id es el activo entregado';
COMMENT ON COLUMN public.transactions.tx_hash                   IS 'Hash de la transacción on-chain para auditoría blockchain';
COMMENT ON COLUMN public.transactions.cancels_transaction_id    IS 'Referencia al registro original que este movimiento anula';

-- =============================================================================
-- TABLA: positions
-- Posición acumulada por (portfolio, activo). Estado calculado a partir del
-- log de transactions por recalculate_position().
-- Sin trigger de updated_at: last_updated lo gestiona exclusivamente la función.
-- =============================================================================
CREATE TABLE public.positions (
  id                         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id               UUID           NOT NULL REFERENCES public.portfolios(id),
  asset_id                   UUID           NOT NULL REFERENCES public.assets(id),

  -- Posición vigente
  quantity_held              DECIMAL(36,18) NOT NULL DEFAULT 0 CHECK (quantity_held >= 0),

  -- Precio promedio ponderado de compra (PPP) y costo base total
  average_cost_price_ars     DECIMAL(20,8)  NOT NULL DEFAULT 0,
  total_cost_basis_ars       DECIMAL(20,4)  NOT NULL DEFAULT 0,
  average_cost_price_usd     DECIMAL(20,8)  NOT NULL DEFAULT 0,
  total_cost_basis_usd       DECIMAL(20,4)  NOT NULL DEFAULT 0,
  avg_fx_mep_at_cost         DECIMAL(20,8),           -- MEP promedio ponderado al que se compraron los activos

  -- Resultado realizado acumulado histórico
  realized_gain_loss_ars     DECIMAL(20,4)  NOT NULL DEFAULT 0,
  realized_gain_loss_usd     DECIMAL(20,4)  NOT NULL DEFAULT 0,

  -- Ingresos recibidos acumulados (rentas, dividendos, rewards — no tocan costo base)
  total_income_received_ars  DECIMAL(20,4)  NOT NULL DEFAULT 0,
  total_income_received_usd  DECIMAL(20,4)  NOT NULL DEFAULT 0,

  -- Fechas de referencia para reporting
  first_purchase_date        DATE,
  last_transaction_date      DATE,
  last_updated               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_positions_portfolio_asset UNIQUE (portfolio_id, asset_id)
);

-- Sin trigger: recalculate_position() setea last_updated manualmente en cada recálculo

COMMENT ON TABLE  public.positions                           IS 'Posición acumulada por portfolio/activo; mantenida por recalculate_position()';
COMMENT ON COLUMN public.positions.quantity_held             IS 'Cantidad neta vigente; DECIMAL(36,18) para precisión cripto';
COMMENT ON COLUMN public.positions.avg_fx_mep_at_cost        IS 'MEP promedio ponderado de todas las compras: separa ganancia de precio vs. cambiaria';
COMMENT ON COLUMN public.positions.realized_gain_loss_ars    IS 'Ganancia/pérdida realizada acumulada histórica en ARS';
COMMENT ON COLUMN public.positions.total_income_received_ars IS 'Rentas, dividendos y rewards acumulados en ARS';
COMMENT ON COLUMN public.positions.last_updated              IS 'Timestamp del último recálculo; seteado por recalculate_position(), no por trigger';

-- =============================================================================
-- TABLA: price_quotes
-- Cotizaciones históricas de precios por activo y fuente.
-- Permite múltiples fuentes para la misma fecha/hora (ej: BYMA vs. RAVA).
-- Unicidad manejada por índices parciales en 004_indexes.sql
-- (necesario porque UNIQUE constraint estándar trata dos NULLs como distintos).
-- =============================================================================
CREATE TABLE public.price_quotes (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID             NOT NULL REFERENCES public.assets(id),
  quote_date  DATE             NOT NULL,
  quote_time  TIME,                            -- NULL = precio de cierre del día
  price       DECIMAL(20,8)    NOT NULL CHECK (price >= 0),
  price_bid   DECIMAL(20,8),
  price_ask   DECIMAL(20,8),
  price_open  DECIMAL(20,8),
  price_high  DECIMAL(20,8),
  price_low   DECIMAL(20,8),
  volume_24h  DECIMAL(36,4),                   -- DECIMAL(36,4) para volúmenes cripto de alta denominación
  market_cap  DECIMAL(36,4),
  currency    public.currency  NOT NULL,
  source      TEXT             NOT NULL,        -- Ej: 'BYMA', 'COINGECKO', 'RAVA', 'MANUAL'
  is_closing  BOOLEAN          NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()

  -- Unicidad manejada por índices parciales en 004_indexes.sql
);

COMMENT ON TABLE  public.price_quotes              IS 'Cotizaciones históricas de precios; múltiples fuentes permitidas para la misma fecha';
COMMENT ON COLUMN public.price_quotes.quote_time   IS 'NULL = cierre diario; con valor = cotización intraday';
COMMENT ON COLUMN public.price_quotes.is_closing   IS 'TRUE si es el precio oficial de cierre de rueda';
COMMENT ON COLUMN public.price_quotes.volume_24h   IS 'DECIMAL(36,4) para volúmenes cripto de alta denominación';
