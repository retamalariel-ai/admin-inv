-- =============================================================================
-- Elimina políticas service_role_all redundantes y corrige personal_portfolio_ownership
--
-- Las políticas "service_role_all" en tablas personal_* no tienen función:
-- el rol service_role de Supabase bypasea RLS por diseño (es equivalente a
-- superuser para operaciones de BD). Tenerlas genera WARNs del linter sin
-- agregar ningún valor de seguridad o funcionalidad.
--
-- personal_portfolio_ownership fue creada en 20260709000002 sin policy
-- admin_all_access, por lo que usuarios autenticados no podían leerla.
-- =============================================================================

SET search_path TO public;

-- Eliminar policies service_role_all redundantes
DROP POLICY IF EXISTS service_role_all ON public.personal_accounts;
DROP POLICY IF EXISTS service_role_all ON public.personal_categories;
DROP POLICY IF EXISTS service_role_all ON public.personal_cards;
DROP POLICY IF EXISTS service_role_all ON public.personal_transactions;
DROP POLICY IF EXISTS service_role_all ON public.personal_installments;
DROP POLICY IF EXISTS service_role_all ON public.personal_subscriptions;
DROP POLICY IF EXISTS service_role_all ON public.personal_portfolio_ownership;

-- Habilitar RLS en personal_portfolio_ownership (omitida en migración anterior)
ALTER TABLE public.personal_portfolio_ownership ENABLE ROW LEVEL SECURITY;

-- Agregar acceso para usuarios autenticados
CREATE POLICY admin_all_access ON public.personal_portfolio_ownership
  FOR ALL
  TO authenticated
  USING  (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
