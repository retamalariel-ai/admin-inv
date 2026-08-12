-- =============================================================================
-- BACKUP: snapshot de transactions, price_quotes y positions para los 3 FCIs
-- afectados por el error de escala 1000× (VCP per 1000 cuotapartes insertado
-- como si fuera per unidad), antes de aplicar el fix.
--
-- COCORMA (565c8cc0) incluido en el WHERE por completitud: 0 filas.
-- Para restaurar: INSERT INTO transactions SELECT * FROM transactions_backup_20260811;
-- =============================================================================

SET search_path TO public;

CREATE TABLE IF NOT EXISTS public.transactions_backup_20260811 AS
SELECT * FROM public.transactions
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',  -- COCOAUSD
  '2bc2bf41-769e-470b-bcf2-408a9c70f421',  -- COCOUSDPA
  '75f164cc-4488-4991-83a3-1e8346b3f77c',  -- COCOSPPA
  '565c8cc0-2a82-46df-85ef-5c90c47aa939'   -- COCORMA (0 filas)
);

CREATE TABLE IF NOT EXISTS public.price_quotes_backup_20260811 AS
SELECT * FROM public.price_quotes
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',
  '2bc2bf41-769e-470b-bcf2-408a9c70f421',
  '75f164cc-4488-4991-83a3-1e8346b3f77c',
  '565c8cc0-2a82-46df-85ef-5c90c47aa939'
);

CREATE TABLE IF NOT EXISTS public.positions_backup_20260811 AS
SELECT * FROM public.positions
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',
  '2bc2bf41-769e-470b-bcf2-408a9c70f421',
  '75f164cc-4488-4991-83a3-1e8346b3f77c',
  '565c8cc0-2a82-46df-85ef-5c90c47aa939'
);
