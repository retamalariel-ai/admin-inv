-- =============================================================================
-- FIX ESCALA 1000×: PASO A — transactions
--
-- El gross_amount y net_amount de todas las transacciones FCI fueron cargados
-- como qty × VCP_per_1000 en vez de qty × (VCP_per_1000 / 1000).
-- Resultado: ambos campos inflados 1000×.
--
-- El trigger after_transaction_insert (FOR EACH ROW) recalcula positions
-- automáticamente después de cada UPDATE. El estado final de positions
-- será correcto una vez que se actualicen las 33 filas.
--
-- ROLLBACK: los valores originales están en transactions_backup_20260811.
-- Para restaurar:
--   UPDATE transactions t
--   SET gross_amount = b.gross_amount, net_amount = b.net_amount
--   FROM transactions_backup_20260811 b
--   WHERE t.id = b.id;
-- =============================================================================

SET search_path TO public;

UPDATE public.transactions
SET
  gross_amount = gross_amount / 1000,
  net_amount   = net_amount   / 1000
WHERE asset_id IN (
  '114be91f-8ae3-496f-9303-11639c597ae1',  -- COCOAUSD
  '2bc2bf41-769e-470b-bcf2-408a9c70f421',  -- COCOUSDPA
  '75f164cc-4488-4991-83a3-1e8346b3f77c'   -- COCOSPPA
);
