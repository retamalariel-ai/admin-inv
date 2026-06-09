-- =============================================================================
-- MIGRACIÓN 002: Tablas base del sistema
-- Orden de ejecución: 2 de 7
-- Descripción: Crea clients (inversores), assets (catálogo de instrumentos)
--              y fx_rates (histórico de tipos de cambio).
--              La tabla assets se auto-referencia en underlying_asset_id.
-- Requisito previo: 001_enums.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- Función auxiliar reutilizable: actualiza updated_at en cada UPDATE
-- Se define acá porque clients y assets la necesitan; se reutiliza en 003.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLA: clients
-- Representa a cada inversor administrado por el asesor financiero.
-- =============================================================================
CREATE TABLE public.clients (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name        TEXT         NOT NULL,
  cuit             CHAR(13),                -- Formato esperado: XX-XXXXXXXX-X
  email            TEXT,
  phone            TEXT,
  risk_profile     TEXT         CHECK (risk_profile IN ('CONSERVADOR', 'MODERADO', 'AGRESIVO')),
  notes            TEXT,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  onboarding_date  DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.clients                IS 'Inversores administrados por el asesor financiero';
COMMENT ON COLUMN public.clients.cuit           IS 'CUIT argentino con guiones: XX-XXXXXXXX-X';
COMMENT ON COLUMN public.clients.risk_profile   IS 'Perfil de riesgo declarado en onboarding';

-- =============================================================================
-- TABLA: assets
-- Catálogo maestro de todos los instrumentos financieros y criptoactivos.
-- La auto-referencia underlying_asset_id modela relaciones como:
--   CEDEAR       → acción subyacente en NYSE/NASDAQ
--   token Earn   → token spot correspondiente
--   token DeFi   → activo colateral o par del pool
-- =============================================================================
CREATE TABLE public.assets (
  id                         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker                     TEXT               NOT NULL UNIQUE,
  name                       TEXT               NOT NULL,
  asset_type                 public.asset_type  NOT NULL,
  currency                   public.currency    NOT NULL,
  settlement_currency        public.currency,

  -- Factor residual: fracción del VN original aún pendiente de amortización.
  -- Arranca en 1.0 y decrece con cada pago de capital (bonos amortizables).
  current_residual_factor    DECIMAL(10,8)      NOT NULL DEFAULT 1.00000000
                             CHECK (current_residual_factor > 0 AND current_residual_factor <= 1),
  residual_factor_updated_at DATE,
  amortization_schedule      JSONB              NOT NULL DEFAULT '[]'::jsonb,

  -- Renta fija
  maturity_date              DATE,
  face_value                 DECIMAL(20,4),
  coupon_rate                DECIMAL(10,8),
  coupon_frequency           INTEGER,           -- Pagos por año (2 = semestral, 4 = trimestral)
  day_count_convention       TEXT
                             CHECK (day_count_convention IN ('ACT/365','ACT/360','30/360','ACT/ACT')),

  -- CEDEARs
  underlying_ticker          TEXT,              -- Ticker del subyacente en su bolsa de origen
  cedear_ratio               DECIMAL(10,4),     -- Cantidad de CEDEARs por 1 acción subyacente

  -- FCIs
  fci_management_company     TEXT,              -- Sociedad gerente (ej: 'Balanz Capital')
  fci_cafci_id               INTEGER,           -- ID en el registro público de CAFCI
  fci_benchmark              TEXT,

  -- Criptoactivos
  blockchain_network         TEXT,              -- Red principal (ej: 'ethereum', 'solana', 'bsc')
  token_contract_address     TEXT,              -- NULL para nativos como BTC o ETH
  coingecko_id               TEXT,              -- ID en CoinGecko para price feeds automáticos
  is_stablecoin              BOOLEAN            NOT NULL DEFAULT FALSE,

  -- Auto-referencia: activo subyacente o relacionado
  underlying_asset_id        UUID               REFERENCES public.assets(id),

  -- Deuda internacional
  isin                       CHAR(12),          -- Código ISO 6166 (12 caracteres alfanuméricos)

  -- Metadatos de gestión
  data_source                TEXT               NOT NULL DEFAULT 'MANUAL',
  is_active                  BOOLEAN            NOT NULL DEFAULT TRUE,
  created_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.assets                              IS 'Catálogo maestro de instrumentos financieros y criptoactivos';
COMMENT ON COLUMN public.assets.ticker                       IS 'Identificador único de mercado (ej: AL30, GGAL, BTC)';
COMMENT ON COLUMN public.assets.current_residual_factor      IS '1.0 = sin amortizar; decrece con cada pago de capital';
COMMENT ON COLUMN public.assets.amortization_schedule        IS 'Array JSON: [{date, pct, payment_per_vn, currency}]';
COMMENT ON COLUMN public.assets.cedear_ratio                 IS 'Número de CEDEARs equivalentes a 1 acción subyacente';
COMMENT ON COLUMN public.assets.underlying_asset_id          IS 'Auto-referencia: subyacente del CEDEAR, del Earn token, etc.';
COMMENT ON COLUMN public.assets.isin                         IS 'International Securities Identification Number (ISO 6166)';

-- =============================================================================
-- TABLA: fx_rates
-- Registro histórico de tipos de cambio ARS/USD con todas las brechas.
-- La unicidad sobre (rate_date, rate_time, source) permite almacenar múltiples
-- fuentes para la misma fecha/hora y comparar MEP/CCL con distintos subyacentes.
-- =============================================================================
CREATE TABLE public.fx_rates (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date      DATE          NOT NULL,
  rate_time      TIME,                        -- NULL = cotización de cierre del día
  rate_oficial   DECIMAL(20,8),               -- Tipo oficial BCRA (Comunicación A3500)
  rate_mep       DECIMAL(20,8),               -- MEP calculado con mep_ticker_ars / mep_ticker_usd
  rate_ccl       DECIMAL(20,8),               -- CCL calculado con ccl_ticker_ars / ccl_ticker_usd
  rate_blue      DECIMAL(20,8),               -- Blue / paralelo (referencia informativa)
  mep_ticker_ars TEXT          NOT NULL DEFAULT 'AL30',   -- Bono ARS usado para calcular el MEP
  mep_ticker_usd TEXT          NOT NULL DEFAULT 'AL30D',  -- Bono USD usado para calcular el MEP
  ccl_ticker_ars TEXT          NOT NULL DEFAULT 'GD30',   -- Bono ARS usado para calcular el CCL
  ccl_ticker_usd TEXT          NOT NULL DEFAULT 'GD30D',  -- Bono USD usado para calcular el CCL
  source         TEXT          NOT NULL,                  -- Ej: 'MANUAL', 'BYMA', 'RAVA', 'AMBITO'
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_fx_rates_date_time_source UNIQUE (rate_date, rate_time, source)
);

COMMENT ON TABLE  public.fx_rates                 IS 'Histórico de tipos de cambio ARS/USD con distintas brechas cambiarias';
COMMENT ON COLUMN public.fx_rates.rate_time        IS 'NULL indica cotización de cierre diario (sin intraday)';
COMMENT ON COLUMN public.fx_rates.rate_mep         IS 'Precio ARS del bono / Precio USD del mismo bono en la misma rueda';
COMMENT ON COLUMN public.fx_rates.rate_ccl         IS 'Igual que MEP pero con liquidación offshore (especie C)';
COMMENT ON COLUMN public.fx_rates.mep_ticker_ars   IS 'Bono en pesos con que se calculó el MEP (default AL30)';
COMMENT ON COLUMN public.fx_rates.ccl_ticker_ars   IS 'Bono en pesos con que se calculó el CCL (default GD30)';
