-- =============================================================================
-- MIGRACIÓN 007: Row Level Security y permisos
-- Orden de ejecución: 7 de 7
-- Descripción: Habilita RLS en todas las tablas operacionales y define una
--              política de acceso total para el único usuario administrador
--              del sistema. Los GRANTs otorgan permisos mínimos necesarios:
--              SELECT + INSERT + UPDATE (sin DELETE — las tablas de log son
--              inmutables por diseño).
-- Requisito previo: 001_enums.sql — 006_views.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Política: uso personal con un único administrador autenticado.
-- La condición USING (true) permite que el administrador vea todas las filas
-- de todas las tablas sin restricción por tenant o por fila.
-- WITH CHECK (true) permite INSERT y UPDATE sobre cualquier fila.
--
-- Nota: si en el futuro se necesita multi-tenant, reemplazar (true) por
-- algo como (client_id = auth.uid()) en las tablas que lo soporten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- portfolios
-- -----------------------------------------------------------------------------
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.portfolios
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- assets
-- El catálogo de instrumentos es de lectura compartida; el admin puede
-- agregar y modificar activos pero nunca eliminarlos (pueden tener posiciones).
-- -----------------------------------------------------------------------------
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.assets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- asset_residual_history
-- Log inmutable de eventos de amortización; RLS evita acceso no autenticado.
-- -----------------------------------------------------------------------------
ALTER TABLE public.asset_residual_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.asset_residual_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- transactions
-- Log INMUTABLE: el RLS no puede reemplazar la regla de negocio que prohíbe
-- DELETE. El GRANT más abajo otorga solo SELECT + INSERT + UPDATE para
-- reforzar esa restricción a nivel de base de datos.
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- positions
-- Mantenida exclusivamente por recalculate_position(). El GRANT sin DELETE
-- evita borrados accidentales desde el cliente que romperían la consistencia
-- con el log de transactions hasta el próximo recálculo.
-- -----------------------------------------------------------------------------
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.positions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- price_quotes
-- -----------------------------------------------------------------------------
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.price_quotes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- fx_rates
-- -----------------------------------------------------------------------------
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.fx_rates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- GRANTS SOBRE VISTAS
--
-- Las vistas heredan el RLS de sus tablas base, pero el rol authenticated
-- necesita permiso explícito de SELECT sobre los objetos de tipo VIEW.
-- =============================================================================
GRANT SELECT ON public.portfolio_valuation_unified TO authenticated;
GRANT SELECT ON public.client_aum_summary          TO authenticated;


-- =============================================================================
-- GRANTS SOBRE TABLAS OPERACIONALES
--
-- Permisos mínimos necesarios por tabla:
--   SELECT  — consulta de datos
--   INSERT  — carga de nuevos registros
--   UPDATE  — modificación de registros existentes (ej: is_cancelled en tx)
--   DELETE  — OMITIDO INTENCIONALMENTE en transactions y positions:
--             · transactions es un log inmutable; la anulación se hace con
--               is_cancelled = TRUE, nunca borrando la fila.
--             · positions es mantenida por recalculate_position(); borrar
--               una fila manualmente dejaría la posición inconsistente con
--               el log de transactions hasta el próximo recálculo.
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON public.clients                  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.portfolios               TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.assets                   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.asset_residual_history   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions             TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.positions                TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.price_quotes             TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fx_rates                 TO authenticated;
-- Las secuencias UUID no requieren GRANT explícito:
-- gen_random_uuid() opera sobre pgcrypto, no sobre secuencias de PostgreSQL.
