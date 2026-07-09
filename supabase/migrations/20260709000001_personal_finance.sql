-- =============================================================================
-- MIGRACIÓN: Módulo de finanzas personales
-- Tablas: cuentas, categorías, tarjetas, transacciones, cuotas, suscripciones
-- =============================================================================

SET search_path TO public;

-- 1. Cuentas/billeteras personales
CREATE TABLE personal_accounts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL,
  type            TEXT          NOT NULL CHECK (type IN (
                    'BANCO_ARS','EFECTIVO_ARS','EFECTIVO_USD',
                    'EFECTIVO_EUR','USDT_WALLET','CRYPTO_WALLET'
                  )),
  currency        TEXT          NOT NULL DEFAULT 'ARS',
  current_balance DECIMAL(20,4) DEFAULT 0,
  owner           TEXT          NOT NULL DEFAULT 'admin',
  is_active       BOOLEAN       DEFAULT true,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- 2. Categorías
CREATE TABLE personal_categories (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  type          TEXT          NOT NULL CHECK (type IN ('INGRESO','EGRESO')),
  icon          TEXT,
  color         TEXT,
  budget_amount DECIMAL(20,4),
  is_active     BOOLEAN       DEFAULT true,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- 3. Tarjetas de crédito
CREATE TABLE personal_cards (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT          NOT NULL,
  bank         TEXT,
  card_type    TEXT          CHECK (card_type IN ('VISA','MASTERCARD','AMEX','EXTRANJERA','OTRO')),
  currency     TEXT          NOT NULL DEFAULT 'ARS',
  closing_day  INTEGER       CHECK (closing_day BETWEEN 1 AND 31),
  due_day      INTEGER       CHECK (due_day BETWEEN 1 AND 31),
  credit_limit DECIMAL(20,4),
  is_active    BOOLEAN       DEFAULT true,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

-- 4. Transacciones personales
CREATE TABLE personal_transactions (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID          REFERENCES personal_accounts(id),
  card_id            UUID          REFERENCES personal_cards(id),
  category_id        UUID          REFERENCES personal_categories(id),
  type               TEXT          NOT NULL CHECK (type IN ('INGRESO','EGRESO','TRANSFERENCIA')),
  amount             DECIMAL(20,4) NOT NULL CHECK (amount > 0),
  currency           TEXT          NOT NULL DEFAULT 'ARS',
  fx_rate            DECIMAL(20,8),
  amount_ars         DECIMAL(20,4),
  description        TEXT,
  date               DATE          NOT NULL DEFAULT CURRENT_DATE,
  installment_number INTEGER,
  total_installments INTEGER,
  created_by         TEXT          DEFAULT 'admin',
  notes              TEXT,
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

-- 5. Cuotas pendientes de tarjetas
CREATE TABLE personal_installments (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id            UUID          REFERENCES personal_cards(id),
  category_id        UUID          REFERENCES personal_categories(id),
  description        TEXT          NOT NULL,
  total_amount       DECIMAL(20,4) NOT NULL,
  installment_amount DECIMAL(20,4) NOT NULL,
  currency           TEXT          NOT NULL DEFAULT 'ARS',
  total_installments INTEGER       NOT NULL,
  paid_installments  INTEGER       DEFAULT 0,
  start_date         DATE          NOT NULL,
  is_active          BOOLEAN       DEFAULT true,
  created_at         TIMESTAMPTZ   DEFAULT NOW()
);

-- 6. Suscripciones recurrentes
CREATE TABLE personal_subscriptions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  amount        DECIMAL(20,4) NOT NULL,
  currency      TEXT          NOT NULL DEFAULT 'ARS',
  frequency     TEXT          CHECK (frequency IN ('SEMANAL','MENSUAL','ANUAL')),
  next_due_date DATE,
  card_id       UUID          REFERENCES personal_cards(id),
  category_id   UUID          REFERENCES personal_categories(id),
  is_active     BOOLEAN       DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_personal_transactions_date     ON personal_transactions (date);
CREATE INDEX idx_personal_transactions_type     ON personal_transactions (type);
CREATE INDEX idx_personal_transactions_category ON personal_transactions (category_id);
CREATE INDEX idx_personal_subscriptions_due     ON personal_subscriptions (next_due_date);

-- Categorías por defecto
INSERT INTO personal_categories (name, type, icon, color) VALUES
  ('Sueldo',           'INGRESO', '💰', '#22c55e'),
  ('Honorarios',       'INGRESO', '💼', '#16a34a'),
  ('Alquiler cobrado', 'INGRESO', '🏠', '#15803d'),
  ('Dividendos',       'INGRESO', '📈', '#166534'),
  ('Alimentación',     'EGRESO',  '🛒', '#ef4444'),
  ('Transporte',       'EGRESO',  '🚗', '#f97316'),
  ('Servicios',        'EGRESO',  '💡', '#eab308'),
  ('Salud',            'EGRESO',  '🏥', '#ec4899'),
  ('Educación',        'EGRESO',  '📚', '#8b5cf6'),
  ('Entretenimiento',  'EGRESO',  '🎬', '#06b6d4'),
  ('Ropa',             'EGRESO',  '👔', '#f59e0b'),
  ('Viajes',           'EGRESO',  '✈️', '#3b82f6'),
  ('Otros',            'EGRESO',  '📦', '#6b7280');
