-- =============================================================================
-- RLS para tablas de finanzas personales
--
-- Las tablas personal_* fueron creadas en 20260709000001_personal_finance.sql
-- sin habilitar Row Level Security. Supabase emitió alerta de seguridad crítica
-- el 17/08/2026 por estar públicamente accesibles (rls_disabled_in_public).
--
-- Política: mismo patrón que el resto del sistema (admin personal único).
-- Acceso irrestricto para cualquier usuario autenticado; si en el futuro
-- se requiere multi-usuario, agregar condición owner = auth.uid().
-- =============================================================================

SET search_path TO public;

-- -----------------------------------------------------------------------------
-- personal_accounts
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- personal_categories
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- personal_cards
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_cards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- personal_transactions
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- personal_installments
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_installments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- personal_subscriptions
-- -----------------------------------------------------------------------------
ALTER TABLE public.personal_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.personal_subscriptions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
