-- =============================================================================
-- MIGRACIÓN: Propiedad personal de portfolios para cálculo de patrimonio neto
-- =============================================================================

SET search_path TO public;

CREATE TABLE personal_portfolio_ownership (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id         UUID          NOT NULL REFERENCES portfolios(id),
  ownership_pct        DECIMAL(5,2)  NOT NULL DEFAULT 100
                       CHECK (ownership_pct BETWEEN 0 AND 100),
  include_in_patrimony BOOLEAN       DEFAULT true,
  notes                TEXT,
  created_at           TIMESTAMPTZ   DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(portfolio_id)
);

CREATE INDEX idx_portfolio_ownership_portfolio ON personal_portfolio_ownership (portfolio_id);
