-- Limpiar duplicados dejando solo el más reciente por (asset_id, quote_date, source)
DELETE FROM public.price_quotes a
USING public.price_quotes b
WHERE a.asset_id   = b.asset_id
  AND a.quote_date = b.quote_date
  AND a.source     = b.source
  AND a.created_at < b.created_at;

-- Eliminar los índices parciales que rompen
-- el ON CONFLICT del upsert
DROP INDEX IF EXISTS public.uq_price_quotes_intraday;
DROP INDEX IF EXISTS public.uq_price_quotes_closing;

-- Crear constraint único simple
-- (un registro por activo/fecha/fuente,
--  actualizado intraday)
ALTER TABLE public.price_quotes
  ADD CONSTRAINT uq_price_quotes_asset_date_source
  UNIQUE (asset_id, quote_date, source);
