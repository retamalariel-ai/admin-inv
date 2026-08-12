-- =============================================================================
-- FIX: fx_rate_mep NULL en transacciones COCOSPPA (75f164cc...)
--
-- Todas las transacciones de COCOSPPA tenían fx_rate_mep = NULL.
-- El trigger recalculate_position() cae al fallback v_fx_mep = 1, con lo que
-- v_net_usd = net_amount_ars / 1 = net_amount_ars (en unidades USD).
-- Resultado: total_cost_basis_usd ≈ 900,000 USD (debería ser ~609 USD) y
-- avg_fx_mep_at_cost = 1.0 (debería ser ~1,477).
-- El widget "Efecto devaluación" usa:
--   fx_gain_loss_ars = total_cost_basis_usd × (fx_hoy − avg_fx_at_cost)
--                    = 900,000 × (1,525 − 1) = $1.37 mil millones  ← bug
-- Post-fix esperado: ~609 × (1,525 − 1,477) ≈ $29,000 ARS
--
-- Tasas MEP tomadas de la tabla fx_rates (cierre de cada día).
-- El trigger recalcula positions automáticamente en cada UPDATE.
--
-- ROLLBACK: UPDATE transactions SET fx_rate_mep = NULL, fx_rate_ccl = NULL
--   WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c';
-- =============================================================================

SET search_path TO public;

-- 2026-04-06  MEP=1430.6  CCL=1482.6
UPDATE public.transactions
SET fx_rate_mep = 1430.6, fx_rate_ccl = 1482.6
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-04-06';

-- 2026-04-08  MEP=1427.9  CCL=1478.8  (2 filas)
UPDATE public.transactions
SET fx_rate_mep = 1427.9, fx_rate_ccl = 1478.8
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-04-08';

-- 2026-04-13  MEP=1409.7  CCL=1466.9
UPDATE public.transactions
SET fx_rate_mep = 1409.7, fx_rate_ccl = 1466.9
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-04-13';

-- 2026-04-20  MEP=1419.0  CCL=1467.0
UPDATE public.transactions
SET fx_rate_mep = 1419.0, fx_rate_ccl = 1467.0
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-04-20';

-- 2026-05-11  MEP=1432.7  CCL=1479.8
UPDATE public.transactions
SET fx_rate_mep = 1432.7, fx_rate_ccl = 1479.8
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-05-11';

-- 2026-05-15  MEP=1429.6  CCL=1485.1
UPDATE public.transactions
SET fx_rate_mep = 1429.6, fx_rate_ccl = 1485.1
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-05-15';

-- 2026-06-05  MEP=1461.4  CCL=1510.5  (RESCATE_FCI — también necesita fx para v_net_usd)
UPDATE public.transactions
SET fx_rate_mep = 1461.4, fx_rate_ccl = 1510.5
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-06-05';

-- 2026-06-19  MEP=1477.02576839  CCL=1475.4312909
UPDATE public.transactions
SET fx_rate_mep = 1477.02576839, fx_rate_ccl = 1475.4312909
WHERE asset_id = '75f164cc-4488-4991-83a3-1e8346b3f77c'
  AND trade_date = '2026-06-19';
