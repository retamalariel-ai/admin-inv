-- =============================================================================
-- MIGRACIÓN: Agrega campos de variación diaria a price_quotes
-- Descripción: previous_close = cierreAnterior de IOL (precio de cierre previo),
--              daily_change_pct = variación % del día vs cierre anterior.
-- Idempotente: usa IF NOT EXISTS.
-- =============================================================================

ALTER TABLE public.price_quotes
  ADD COLUMN IF NOT EXISTS previous_close    DECIMAL(20, 8),
  ADD COLUMN IF NOT EXISTS daily_change_pct  DECIMAL(10, 6);

COMMENT ON COLUMN public.price_quotes.previous_close IS
  'Precio de cierre del día anterior (cierreAnterior de IOL). Mismo scale que price.';

COMMENT ON COLUMN public.price_quotes.daily_change_pct IS
  'Variación porcentual del día: (price - previous_close) / previous_close. Ej: 0.0469 = +4.69%.';
