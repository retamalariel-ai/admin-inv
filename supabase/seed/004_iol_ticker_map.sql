-- =============================================================================
-- SEED 004: Mapa de tickers DB → IOL (Invertir Online / BYMA)
-- Tipo: datos iniciales (seed), NO es una migración de esquema
-- Descripción: Registra los alias de tickers entre nuestra base de datos
--              y la nomenclatura usada por IOL/BYMA.
--              Los bonos Globales USD (GD*) se denominan AE* en IOL.
--              Los Bonares (AL*) y acciones son idénticos en ambos sistemas.
-- Idempotente: usa ON CONFLICT DO NOTHING — re-ejecutable sin errores.
-- Requisito previo: tabla asset_ticker_aliases existente.
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- Crear tabla si no existe (idempotente)
CREATE TABLE IF NOT EXISTS public.asset_ticker_aliases (
  id          BIGSERIAL    PRIMARY KEY,
  db_ticker   TEXT         NOT NULL,
  source      TEXT         NOT NULL,  -- 'IOL', 'PPI', 'BYMA', etc.
  alias       TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (db_ticker, source)
);

COMMENT ON TABLE public.asset_ticker_aliases IS
  'Mapa de traducción entre ticker interno (db_ticker) y ticker del proveedor (alias). '
  'Un mismo activo puede tener alias distintos según la fuente de precios.';

-- =============================================================================
-- ALIAS IOL — Bonos Globales USD (especie ARS)
-- GD* en nuestra DB → AE* en IOL/BYMA
-- =============================================================================
INSERT INTO public.asset_ticker_aliases (db_ticker, source, alias)
VALUES
  ('GD29', 'IOL', 'AE29'),
  ('GD30', 'IOL', 'AE30'),
  ('GD35', 'IOL', 'AE35'),
  ('GD38', 'IOL', 'AE38'),
  ('GD41', 'IOL', 'AE41'),
  ('GD46', 'IOL', 'AE46')
ON CONFLICT (db_ticker, source) DO NOTHING;

-- =============================================================================
-- ALIAS IOL — Bonos Globales USD (especie D — precio en USD/CCL)
-- GD*D en DB → AE*D en IOL, excepto GD30D que permanece igual
-- =============================================================================
INSERT INTO public.asset_ticker_aliases (db_ticker, source, alias)
VALUES
  ('GD29D', 'IOL', 'AE29D'),
  ('GD30D', 'IOL', 'GD30D'),  -- permanece igual en IOL
  ('GD35D', 'IOL', 'AE35D'),
  ('GD38D', 'IOL', 'AE38D'),
  ('GD41D', 'IOL', 'AE41D'),
  ('GD46D', 'IOL', 'AE46D')
ON CONFLICT (db_ticker, source) DO NOTHING;

-- =============================================================================
-- ALIAS IOL — Bonares ARS y USD (iguales en IOL)
-- AL* permanecen igual
-- =============================================================================
INSERT INTO public.asset_ticker_aliases (db_ticker, source, alias)
VALUES
  ('AL29',  'IOL', 'AL29'),
  ('AL30',  'IOL', 'AL30'),
  ('AL35',  'IOL', 'AL35'),
  ('AL41',  'IOL', 'AL41'),
  ('AL30D', 'IOL', 'AL30D'),
  ('AL35D', 'IOL', 'AL35D'),
  ('AL41D', 'IOL', 'AL41D')
ON CONFLICT (db_ticker, source) DO NOTHING;

-- =============================================================================
-- ALIAS IOL — Acciones locales (iguales en IOL)
-- =============================================================================
INSERT INTO public.asset_ticker_aliases (db_ticker, source, alias)
VALUES
  ('GGAL',  'IOL', 'GGAL'),
  ('YPFD',  'IOL', 'YPFD'),
  ('BMA',   'IOL', 'BMA'),
  ('PAMP',  'IOL', 'PAMP'),
  ('VIST',  'IOL', 'VIST'),
  ('LOMA',  'IOL', 'LOMA'),
  ('TXAR',  'IOL', 'TXAR'),
  ('ALUA',  'IOL', 'ALUA'),
  ('TECO2', 'IOL', 'TECO2'),
  ('HARG',  'IOL', 'HARG'),
  ('SUPV',  'IOL', 'SUPV'),
  ('BBAR',  'IOL', 'BBAR'),
  ('CRES',  'IOL', 'CRES')
ON CONFLICT (db_ticker, source) DO NOTHING;
