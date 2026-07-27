-- =============================================================================
-- MIGRACIÓN: earn_positions
-- Descripción: Tabla de configuración para posiciones Earn activas.
--              Almacena capital, APY y plataforma por asset/portfolio.
--              El cálculo de interés proyectado ocurre en el frontend.
-- =============================================================================

SET search_path TO public;

CREATE TABLE public.earn_positions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID          NOT NULL REFERENCES public.assets(id),
  portfolio_id     UUID          NOT NULL REFERENCES public.portfolios(id),
  principal_amount DECIMAL(20,8) NOT NULL,
  apy_pct          DECIMAL(8,4)  NOT NULL,
  platform         TEXT,
  currency         TEXT          NOT NULL DEFAULT 'USDT',
  start_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (asset_id, portfolio_id, platform)
);

CREATE TRIGGER trg_earn_positions_updated_at
  BEFORE UPDATE ON public.earn_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.earn_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.earn_positions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.earn_positions TO authenticated;
