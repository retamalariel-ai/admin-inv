-- =============================================================================
-- MIGRACIÓN 008: Tablas de comisiones
-- Orden de ejecución: 8 de 9
-- Descripción: Crea commission_agreements (acuerdos de honorarios por cliente)
--              y commission_records (registro de comisiones devengadas y cobradas).
--              Incluye índices de performance y políticas RLS.
--              Estas tablas fueron referenciadas en los GRANTs de 007 pero
--              se crean en esta migración separada para mantener cohesión.
-- Requisito previo: 001_enums.sql, 002_tables_base.sql, 003_tables_dependent.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- TABLA: commission_agreements
-- Define el modelo de honorarios acordado con cada cliente.
-- Un cliente puede tener múltiples acuerdos a lo largo del tiempo
-- (effective_from / effective_to delimitan su vigencia).
-- Solo el acuerdo con effective_to IS NULL está actualmente vigente.
-- =============================================================================
CREATE TABLE public.commission_agreements (
  id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID                    NOT NULL REFERENCES public.clients(id),
  commission_type  public.commission_type  NOT NULL,

  -- Para comisiones de tipo PORCENTAJE_AUM o PORCENTAJE_GANANCIA
  -- Ej: 0.015000 = 1.50% anual sobre AUM
  rate             DECIMAL(8,6),

  -- Para comisiones de tipo FEE_FIJO_MENSUAL o FEE_POR_OPERACION
  fixed_amount     DECIMAL(20,4),
  fixed_currency   public.currency,

  -- High Water Mark: el portfolio debe superar este valor histórico
  -- antes de que se cobre PORCENTAJE_GANANCIA nuevamente.
  -- Se actualiza cada vez que se cobra una comisión de performance.
  high_water_mark  DECIMAL(20,4)           NOT NULL DEFAULT 0,
  hwm_currency     public.currency         NOT NULL DEFAULT 'USD_MEP',

  -- Moneda de liquidación de la comisión (puede diferir de la moneda del portfolio)
  currency         public.currency         NOT NULL DEFAULT 'ARS',

  -- Período de vigencia del acuerdo
  effective_from   DATE                    NOT NULL,
  effective_to     DATE,                   -- NULL = acuerdo actualmente vigente

  notes            TEXT,
  created_at       TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.commission_agreements                 IS 'Acuerdos de honorarios por cliente con período de vigencia';
COMMENT ON COLUMN public.commission_agreements.rate            IS 'Tasa para % AUM o % ganancia (ej: 0.015000 = 1.50% anual)';
COMMENT ON COLUMN public.commission_agreements.high_water_mark IS 'AUM máximo histórico; solo se cobra % ganancia sobre lo que supera este valor';
COMMENT ON COLUMN public.commission_agreements.hwm_currency    IS 'Moneda de referencia del HWM (generalmente USD_MEP para comparar en términos reales)';
COMMENT ON COLUMN public.commission_agreements.effective_to    IS 'NULL indica que el acuerdo está actualmente vigente';

-- =============================================================================
-- TABLA: commission_records
-- Registro de cada comisión devengada, facturada y/o cobrada.
-- Inmutable en la práctica: los errores se anulan con status = ANULADA
-- y se inserta un nuevo registro corregido.
-- =============================================================================
CREATE TABLE public.commission_records (
  id                  UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id        UUID                      NOT NULL REFERENCES public.commission_agreements(id),
  client_id           UUID                      NOT NULL REFERENCES public.clients(id),

  -- NULL si la comisión aplica al cliente completo (suma de todos sus portfolios)
  portfolio_id        UUID                      REFERENCES public.portfolios(id),

  -- Período de cálculo
  period_from         DATE                      NOT NULL,
  period_to           DATE                      NOT NULL,

  -- Bases de cálculo (se persisten para auditoría futura)
  aum_at_calculation  DECIMAL(20,4),            -- AUM promedio del período (base para % AUM)
  gain_in_period      DECIMAL(20,4),            -- Ganancia del período (base para % ganancia)

  -- Resultado
  commission_amount   DECIMAL(20,4)             NOT NULL,
  currency            public.currency           NOT NULL,
  fx_rate_used        DECIMAL(20,8),            -- TC aplicado si hubo conversión de moneda

  -- Ciclo de vida
  status              public.commission_status  NOT NULL DEFAULT 'DEVENGADA',
  invoiced_at         TIMESTAMPTZ,              -- Momento en que se emitió la factura / recibo
  collected_at        TIMESTAMPTZ,              -- Momento en que se acreditó el cobro
  collection_notes    TEXT,

  created_at          TIMESTAMPTZ               NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.commission_records                   IS 'Registro de comisiones devengadas, facturadas y cobradas por cliente';
COMMENT ON COLUMN public.commission_records.portfolio_id      IS 'NULL si la comisión se calcula sobre el AUM total del cliente';
COMMENT ON COLUMN public.commission_records.aum_at_calculation IS 'AUM promedio del período; se persiste para auditoría aunque el portfolio cambie después';
COMMENT ON COLUMN public.commission_records.gain_in_period    IS 'Ganancia del período usada de base; se persiste para auditoría';
COMMENT ON COLUMN public.commission_records.fx_rate_used      IS 'Tipo de cambio aplicado si commission_amount está en moneda distinta a la del AUM';
COMMENT ON COLUMN public.commission_records.invoiced_at       IS 'Timestamp de emisión de factura o recibo al cliente';
COMMENT ON COLUMN public.commission_records.collected_at      IS 'Timestamp de acreditación efectiva del cobro';

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Todos los acuerdos de un cliente (para mostrar historial de honorarios)
CREATE INDEX idx_comm_agreements_client
  ON public.commission_agreements (client_id);

-- Comisiones de un cliente ordenadas por período descendente (reporting mensual)
CREATE INDEX idx_comm_records_client_period
  ON public.commission_records (client_id, period_from DESC);

-- Filtro rápido de comisiones pendientes de cobro (dashboard de cobranza)
CREATE INDEX idx_comm_records_status
  ON public.commission_records (status)
  WHERE status = 'DEVENGADA';

-- =============================================================================
-- ROW LEVEL SECURITY
-- Misma política que el resto del sistema: acceso total para el admin autenticado.
-- =============================================================================
ALTER TABLE public.commission_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.commission_agreements
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_access" ON public.commission_records
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- GRANTS
-- Sin DELETE: los errores se corrigen con status = 'ANULADA' + nuevo registro.
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON public.commission_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commission_records    TO authenticated;
