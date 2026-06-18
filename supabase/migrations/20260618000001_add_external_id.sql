-- =============================================================================
-- MIGRACIÓN: Agrega external_id a transactions para deduplicación de imports
-- =============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id
  ON public.transactions (external_id)
  WHERE external_id IS NOT NULL;
