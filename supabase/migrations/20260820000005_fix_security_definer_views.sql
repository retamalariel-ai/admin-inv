-- =============================================================================
-- Fix: security_definer_view y rls_disabled_in_public en tablas backup
--
-- 1. security_definer_view (ERROR)
--    Las vistas portfolio_valuation_unified y client_aum_summary fueron creadas
--    con el comportamiento por defecto de PostgreSQL: SECURITY DEFINER (usan
--    los permisos del owner de la vista, no del usuario que consulta).
--    Esto hace que RLS de las tablas subyacentes se evalúe con los permisos del
--    creador en vez del cliente. Fix: security_invoker = on (PostgreSQL 15+).
--
-- 2. rls_disabled_in_public (ERROR)
--    price_quotes_backup_20260811, positions_backup_20260811 y
--    transactions_backup_20260811 son tablas temporales creadas en la migración
--    del 11/08/2026 como respaldo de seguridad. Ya no son necesarias y exponen
--    datos sensibles sin RLS. Se eliminan directamente.
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- PARTE 1: Cambiar vistas a SECURITY INVOKER
-- El comportamiento pasa a evaluarse con los permisos del usuario que consulta,
-- lo que alinea las vistas con el modelo RLS del resto del sistema.
-- =============================================================================

ALTER VIEW public.portfolio_valuation_unified
  SET (security_invoker = on);

ALTER VIEW public.client_aum_summary
  SET (security_invoker = on);

-- =============================================================================
-- PARTE 2: Eliminar tablas backup obsoletas
-- Creadas como respaldo en 20260811000001_price_quotes_usd_fci.sql.
-- Ya no tienen utilidad operacional y están expuestas sin RLS.
-- =============================================================================

DROP TABLE IF EXISTS public.price_quotes_backup_20260811;
DROP TABLE IF EXISTS public.positions_backup_20260811;
DROP TABLE IF EXISTS public.transactions_backup_20260811;
