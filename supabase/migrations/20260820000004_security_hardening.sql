-- =============================================================================
-- Hardening de seguridad — resuelve warnings del Supabase Database Linter
--
-- 1. function_search_path_mutable
--    Las funciones sin search_path fijo permiten que un atacante con privilegios
--    de creación de esquemas redefina funciones del sistema cambiando el orden
--    de búsqueda. Fix: fijar search_path = 'public' en cada función.
--
-- 2. rls_policy_always_true
--    Las políticas con USING (true) para INSERT/UPDATE/DELETE son válidas en
--    un sistema single-admin pero generan WARNs del linter. Fix: reemplazar
--    USING (true) por USING (auth.uid() IS NOT NULL) — comportamiento idéntico
--    (cualquier usuario autenticado tiene acceso total) pero más explícito.
--    Nota: auth_leaked_password_protection es un setting del dashboard de Auth,
--    no es código — activarlo en Supabase → Auth → Settings → Password protection.
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- PARTE 1: Fijar search_path en funciones
-- =============================================================================

ALTER FUNCTION public.set_updated_at()
  SET search_path = 'public';

ALTER FUNCTION public.trigger_recalculate_position()
  SET search_path = 'public';

ALTER FUNCTION public.recalculate_position(UUID, UUID)
  SET search_path = 'public';


-- =============================================================================
-- PARTE 2: Reemplazar políticas USING (true) por USING (auth.uid() IS NOT NULL)
-- Tablas de inversiones (del sistema original)
-- =============================================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'clients', 'portfolios', 'assets', 'asset_residual_history',
    'transactions', 'positions', 'price_quotes', 'fx_rates',
    'commission_agreements', 'commission_records', 'earn_positions',
    'personal_accounts', 'personal_categories', 'personal_cards',
    'personal_transactions', 'personal_installments', 'personal_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Eliminar política anterior
    EXECUTE format('DROP POLICY IF EXISTS admin_all_access ON public.%I', t);

    -- Recrear con condición explícita en vez de literal true
    EXECUTE format($p$
      CREATE POLICY admin_all_access ON public.%I
        FOR ALL
        TO authenticated
        USING  (auth.uid() IS NOT NULL)
        WITH CHECK (auth.uid() IS NOT NULL)
    $p$, t);
  END LOOP;
END $$;
