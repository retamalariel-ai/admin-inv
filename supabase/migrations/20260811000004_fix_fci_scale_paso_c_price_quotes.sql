-- =============================================================================
-- FIX ESCALA 1000×: PASO C — price_quotes
--
-- Los precios insertados para los FCIs son VCP per 1000 cuotapartes (ej:
-- price=1088120 en vez de 1088.12). Hay que dividir por 1000.
--
-- Para COCOAUSD y COCOUSDPA también hay price_usd (insertado como ~1088 USD
-- per 1000 cuotapartes), que debe dividirse igualmente.
--
-- ROLLBACK: los valores originales están en price_quotes_backup_20260811.
-- =============================================================================

SET search_path TO public;

-- Dividir price por 1000 para los 3 FCIs
UPDATE public.price_quotes
SET price = price / 1000
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',  -- COCOAUSD
  '2bc2bf41-769e-470b-bcf2-408a9c70f421',  -- COCOUSDPA
  '75f164cc-4488-4991-83a3-1e8346b3f77c'   -- COCOSPPA
);

-- Dividir price_usd por 1000 para los FCIs USD donde fue cargado
UPDATE public.price_quotes
SET price_usd = price_usd / 1000
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',  -- COCOAUSD
  '2bc2bf41-769e-470b-bcf2-408a9c70f421'   -- COCOUSDPA
)
  AND price_usd IS NOT NULL;
