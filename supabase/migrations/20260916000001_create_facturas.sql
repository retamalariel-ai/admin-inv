-- Tabla de facturas para monotributista (Comprobantes tipo C)
CREATE TABLE personal_facturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL,
  fecha_emision   DATE NOT NULL,
  fecha_cobro     DATE,
  cliente_nombre  TEXT NOT NULL,
  cliente_cuit    TEXT,
  concepto        TEXT NOT NULL,
  monto           NUMERIC(14,2) NOT NULL,
  moneda          TEXT NOT NULL DEFAULT 'ARS',
  estado          TEXT NOT NULL DEFAULT 'EMITIDA',
  cuenta_cobro_id UUID REFERENCES personal_accounts(id),
  notas           TEXT,
  arca_link       TEXT DEFAULT 'https://facturador.afip.gob.ar',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE personal_facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON personal_facturas FOR ALL USING (true);
