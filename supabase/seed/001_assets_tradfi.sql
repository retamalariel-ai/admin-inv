-- =============================================================================
-- SEED 001: Activos del mercado de capitales argentino
-- Tipo: datos iniciales (seed), NO es una migración de esquema
-- Descripción: Carga el catálogo base de instrumentos financieros del
--              mercado de capitales argentino: acciones locales, CEDEARs,
--              bonos soberanos, LECAPs y posiciones de cash.
-- Idempotente: usa ON CONFLICT (ticker) DO NOTHING — re-ejecutable sin errores.
-- Requisito previo: todas las migraciones 001-007 aplicadas.
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- ACCIONES LOCALES
-- Cotizan en BYMA en pesos argentinos. Precio en ARS por unidad.
-- Sin amortización, sin vencimiento.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, data_source, is_stablecoin
)
VALUES
  ('GGAL',  'Grupo Financiero Galicia',            'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('YPF',   'YPF S.A.',                            'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('BMA',   'Banco Macro',                         'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('TXAR',  'Ternium Argentina',                   'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('ALUA',  'Aluar Aluminio Argentino',            'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('PAMP',  'Pampa Energía',                       'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('TECO2', 'Telecom Argentina',                   'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('BBAR',  'BBVA Argentina',                      'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('SUPV',  'Grupo Supervielle',                   'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('VALO',  'Grupo Financiero Valores',            'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('BYMA',  'Bolsas y Mercados Argentinos',        'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('IRSA',  'IRSA Inversiones y Representaciones', 'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('CEPU',  'Central Puerto',                      'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('CRES',  'Cresud',                              'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE),
  ('LOMA',  'Loma Negra',                          'ACCION_LOCAL', 'ARS', 'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- CEDEARs
-- Cotizan en ARS en BYMA. Liquidan en USD CCL (especie C).
-- cedear_ratio = cantidad de CEDEARs equivalentes a 1 acción subyacente.
-- underlying_ticker referencia el ticker del subyacente en su mercado de origen.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, settlement_currency,
  underlying_ticker, cedear_ratio, data_source, is_stablecoin
)
VALUES
  ('AAPL',  'Apple Inc.',            'CEDEAR', 'ARS', 'USD_CCL', 'AAPL',  10,  'MANUAL', FALSE),
  ('MSFT',  'Microsoft Corporation', 'CEDEAR', 'ARS', 'USD_CCL', 'MSFT',  10,  'MANUAL', FALSE),
  ('GOOGL', 'Alphabet Inc.',         'CEDEAR', 'ARS', 'USD_CCL', 'GOOGL',  5,  'MANUAL', FALSE),
  ('AMZN',  'Amazon.com Inc.',       'CEDEAR', 'ARS', 'USD_CCL', 'AMZN',   8,  'MANUAL', FALSE),
  ('NVDA',  'NVIDIA Corporation',    'CEDEAR', 'ARS', 'USD_CCL', 'NVDA',  20,  'MANUAL', FALSE),
  ('META',  'Meta Platforms Inc.',   'CEDEAR', 'ARS', 'USD_CCL', 'META',   8,  'MANUAL', FALSE),
  ('TSLA',  'Tesla Inc.',            'CEDEAR', 'ARS', 'USD_CCL', 'TSLA',  10,  'MANUAL', FALSE),
  ('BRKB',  'Berkshire Hathaway B',  'CEDEAR', 'ARS', 'USD_CCL', 'BRK/B',  3, 'MANUAL', FALSE),
  ('JPM',   'JPMorgan Chase & Co.',  'CEDEAR', 'ARS', 'USD_CCL', 'JPM',    5,  'MANUAL', FALSE),
  ('KO',    'Coca-Cola Company',     'CEDEAR', 'ARS', 'USD_CCL', 'KO',     3,  'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- BONOS SOBERANOS — Serie AL (BONARES, ley argentina)
-- Cotizan en ARS en BYMA. Liquidan en USD MEP (especie D).
-- face_value = 1 (valor nominal unitario base).
-- coupon_frequency = 2 (pagos semestrales).
-- IMPORTANTE: current_residual_factor arranca en 1.0 pero debe actualizarse
-- con cada pago de capital usando la tabla asset_residual_history.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, settlement_currency,
  face_value, coupon_rate, coupon_frequency, day_count_convention,
  maturity_date, data_source, is_stablecoin
)
VALUES
  ('AL29', 'BONAR 2029 — Ley Argentina', 'BONO_SOBERANO', 'ARS', 'USD_MEP',
   1, 0.0125, 2, 'ACT/ACT', '2029-07-09', 'MANUAL', FALSE),

  ('AL30', 'BONAR 2030 — Ley Argentina', 'BONO_SOBERANO', 'ARS', 'USD_MEP',
   1, 0.0125, 2, 'ACT/ACT', '2030-07-09', 'MANUAL', FALSE),

  ('AL35', 'BONAR 2035 — Ley Argentina', 'BONO_SOBERANO', 'ARS', 'USD_MEP',
   1, 0.0125, 2, 'ACT/ACT', '2035-07-09', 'MANUAL', FALSE),

  -- AO26: vence en julio 2026; incluido activo para posiciones vigentes
  ('AO26', 'BONAR 2026 — Ley Argentina', 'BONO_SOBERANO', 'ARS', 'USD_MEP',
   1, 0.0000, 2, 'ACT/ACT', '2026-07-09', 'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- BONOS SOBERANOS — Serie GD (GLOBALES, ley extranjera — Nueva York)
-- Cotizan en USD en mercados internacionales.
-- En Argentina liquidan en USD CCL (especie C).
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, settlement_currency,
  face_value, coupon_rate, coupon_frequency, day_count_convention,
  maturity_date, data_source, is_stablecoin
)
VALUES
  ('GD29', 'GLOBAL 2029 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2029-07-09', 'MANUAL', FALSE),

  ('GD30', 'GLOBAL 2030 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2030-01-09', 'MANUAL', FALSE),

  ('GD35', 'GLOBAL 2035 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2035-07-09', 'MANUAL', FALSE),

  ('GD38', 'GLOBAL 2038 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2038-01-09', 'MANUAL', FALSE),

  ('GD41', 'GLOBAL 2041 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2041-07-09', 'MANUAL', FALSE),

  ('GD46', 'GLOBAL 2046 — Ley Nueva York', 'BONO_SOBERANO', 'USD_CCL', 'USD_CCL',
   1, 0.0125, 2, 'ACT/ACT', '2046-07-09', 'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- LETRAS DE CAPITALIZACIÓN (LECAP)
-- Instrumentos de descuento en ARS. coupon_rate = 0 (zero coupon).
-- TV25 venció el 21/03/2025 → is_active = FALSE para conservar historial
-- de posiciones de clientes que lo tuvieron en cartera.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency,
  face_value, coupon_rate, coupon_frequency, day_count_convention,
  maturity_date, data_source, is_stablecoin, is_active
)
VALUES
  ('TV25', 'LECAP Vencimiento Marzo 2025', 'LECAP', 'ARS',
   1, 0.0000, 0, 'ACT/365', '2025-03-21', 'MANUAL', FALSE, FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- POSICIONES DE CASH
-- Representan saldos disponibles en cartera, sin precio de mercado.
-- Se valúan 1:1 con su moneda base en la vista portfolio_valuation_unified.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, data_source, is_stablecoin
)
VALUES
  ('CASH_ARS', 'Saldo en Pesos Argentinos', 'CASH_ARS',     'ARS',     'MANUAL', FALSE),
  ('CASH_MEP', 'Saldo en Dólares MEP',      'CASH_USD_MEP', 'USD_MEP', 'MANUAL', FALSE),
  ('CASH_CCL', 'Saldo en Dólares CCL',      'CASH_USD_CCL', 'USD_CCL', 'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;
