-- =============================================================================
-- MIGRACIÓN: Precio de activos sintéticos via underlying_asset_id
--
-- Problema: assets como USDT-EARN, USDC-MORPHO, USDC-KAMINO, USDC-VESSEO,
-- SOL-STAKE no tienen entradas propias en price_quotes. La vista hacía:
--   LEFT JOIN latest_prices lp ON lp.asset_id = pos.asset_id
-- → lp.current_price = NULL → market_value_usd = 0.
--
-- Fix:
--   1. Actualizar underlying_asset_id en assets para los sintéticos.
--   2. LEFT JOIN latest_prices lp_underlying ON a.underlying_asset_id.
--   3. COALESCE(lp.*, lp_underlying.*) en todas las columnas de precio:
--      current_price, previous_close, daily_change_pct, price_currency,
--      price_date, price_source.
--
-- Basada en la versión actual: 20260609000003_view_daily_pnl.sql
-- (incluye previous_close, daily_change_pct, daily_pnl_ars).
-- =============================================================================

SET search_path TO public;

-- ── 1. Registrar underlying assets para los sintéticos ────────────────────────
UPDATE public.assets
  SET underlying_asset_id = 'a50938b7-29f5-4b39-ad6b-ad858bb3e868'  -- USDT
  WHERE ticker = 'USDT-EARN';

UPDATE public.assets
  SET underlying_asset_id = 'c38034fe-39c4-4bb2-8f58-503d56e62a5a'  -- USDC
  WHERE ticker IN ('USDC-MORPHO', 'USDC-KAMINO', 'USDC-VESSEO');

UPDATE public.assets
  SET underlying_asset_id = '467058f8-9375-4030-b478-886ffb87d734'  -- SOL
  WHERE ticker = 'SOL-STAKE';

-- ── 2. DROP en orden inverso de dependencia ────────────────────────────────────
DROP VIEW IF EXISTS public.client_aum_summary;
DROP VIEW IF EXISTS public.portfolio_valuation_unified;

-- ── 3. Vista principal con soporte de underlying price ────────────────────────
CREATE VIEW public.portfolio_valuation_unified AS
WITH

-- CTE 1: Último precio por activo (incluye previous_close y daily_change_pct)
latest_prices AS (
  SELECT DISTINCT ON (asset_id)
    asset_id,
    price             AS current_price,
    previous_close,
    daily_change_pct,
    currency          AS price_currency,
    quote_date        AS price_date,
    source            AS price_source
  FROM  public.price_quotes
  ORDER BY asset_id, quote_date DESC, quote_time DESC NULLS LAST
),

-- CTE 2: Tipo de cambio más reciente
latest_fx AS (
  SELECT
    rate_mep     AS fx_mep_today,
    rate_ccl     AS fx_ccl_today,
    rate_oficial AS fx_oficial_today,
    rate_date    AS fx_date
  FROM  public.fx_rates
  ORDER BY rate_date DESC, rate_time DESC NULLS LAST
  LIMIT 1
),

-- CTE 3: Valuación base
base AS (
  SELECT
    p.id            AS portfolio_id,
    p.name          AS portfolio_name,
    p.custodian_name,
    p.custodian_type,
    c.id            AS client_id,
    c.full_name     AS client_name,

    a.id            AS asset_id,
    a.ticker,
    a.name          AS asset_name,
    a.asset_type,
    a.currency      AS asset_currency,
    a.settlement_currency,
    a.current_residual_factor,
    a.is_stablecoin,
    a.blockchain_network,

    pos.quantity_held,
    pos.quantity_held * a.current_residual_factor AS quantity_effective,

    -- Precio efectivo: propio si existe, sino del underlying (ej: USDT-EARN → USDT)
    COALESCE(lp.current_price,   lp_u.current_price)   AS current_price,
    COALESCE(lp.previous_close,  lp_u.previous_close)  AS previous_close,
    COALESCE(lp.daily_change_pct,lp_u.daily_change_pct)AS daily_change_pct,
    COALESCE(lp.price_date,      lp_u.price_date)      AS price_date,
    COALESCE(lp.price_source,    lp_u.price_source)    AS price_source,
    fx.fx_mep_today,
    fx.fx_ccl_today,
    fx.fx_date,

    pos.average_cost_price_ars  AS ppp_ars,
    pos.total_cost_basis_ars,
    pos.average_cost_price_usd  AS ppp_usd,
    pos.total_cost_basis_usd,
    pos.avg_fx_mep_at_cost,

    -- -------------------------------------------------------------------------
    -- market_value_ars
    -- Para bonos: usar price_currency del precio real (no assets.currency).
    -- -------------------------------------------------------------------------
    CASE
      WHEN a.asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
        CASE
          WHEN COALESCE(lp.price_currency, lp_u.price_currency) = 'ARS' THEN
            pos.quantity_held
              * COALESCE(lp.current_price, lp_u.current_price, 0)
              * a.current_residual_factor
          WHEN COALESCE(lp.price_currency, lp_u.price_currency)
               IN ('USD_MEP','USD_CCL','USD_CABLE') THEN
            pos.quantity_held
              * COALESCE(lp.current_price, lp_u.current_price, 0)
              * a.current_residual_factor
              * COALESCE(fx.fx_mep_today, 0)
          ELSE
            CASE
              WHEN a.currency = 'ARS' THEN
                pos.quantity_held
                  * COALESCE(lp.current_price, lp_u.current_price, 0)
                  * a.current_residual_factor
              ELSE
                pos.quantity_held
                  * COALESCE(lp.current_price, lp_u.current_price, 0)
                  * a.current_residual_factor
                  * COALESCE(fx.fx_mep_today, 0)
            END
        END

      WHEN a.asset_type IN ('ACCION_LOCAL','CEDEAR',
           'FCI_MONEY_MARKET','FCI_RENTA_FIJA','FCI_RENTA_VARIABLE','FCI_RENTA_MIXTA') THEN
        pos.quantity_held * COALESCE(lp.current_price, lp_u.current_price, 0)

      WHEN a.asset_type IN ('CRYPTO_SPOT','CRYPTO_STABLECOIN','CRYPTO_EARN',
           'CRYPTO_DEFI_LP','CRYPTO_DEFI_STAKE','CRYPTO_DEFI_LENDING') THEN
        pos.quantity_held
          * COALESCE(lp.current_price, lp_u.current_price, 0)
          * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_ARS' THEN
        pos.quantity_held

      WHEN a.asset_type = 'CASH_CRYPTO_NATIVE' THEN
        pos.quantity_held
          * COALESCE(lp.current_price, lp_u.current_price, 0)
          * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type IN ('CASH_USD_MEP','CASH_CRYPTO_STABLE') THEN
        pos.quantity_held * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_USD_CCL' THEN
        pos.quantity_held * COALESCE(fx.fx_ccl_today, 0)

      ELSE
        pos.quantity_held * COALESCE(lp.current_price, lp_u.current_price, 0)
    END AS market_value_ars,

    -- -------------------------------------------------------------------------
    -- market_value_usd
    -- -------------------------------------------------------------------------
    CASE
      WHEN a.asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
        CASE
          WHEN COALESCE(lp.price_currency, lp_u.price_currency) = 'ARS' THEN
            pos.quantity_held
              * COALESCE(lp.current_price, lp_u.current_price, 0)
              * a.current_residual_factor
              / NULLIF(fx.fx_mep_today, 0)
          WHEN COALESCE(lp.price_currency, lp_u.price_currency)
               IN ('USD_MEP','USD_CCL','USD_CABLE') THEN
            pos.quantity_held
              * COALESCE(lp.current_price, lp_u.current_price, 0)
              * a.current_residual_factor
          ELSE
            pos.quantity_held
              * COALESCE(lp.current_price, lp_u.current_price, 0)
              * a.current_residual_factor
              / NULLIF(fx.fx_mep_today, 0)
        END

      WHEN a.asset_type IN ('ACCION_LOCAL','CEDEAR',
           'FCI_MONEY_MARKET','FCI_RENTA_FIJA','FCI_RENTA_VARIABLE','FCI_RENTA_MIXTA') THEN
        pos.quantity_held
          * COALESCE(lp.current_price, lp_u.current_price, 0)
          / NULLIF(fx.fx_mep_today, 0)

      WHEN a.asset_type IN ('CRYPTO_SPOT','CRYPTO_STABLECOIN','CRYPTO_EARN',
           'CRYPTO_DEFI_LP','CRYPTO_DEFI_STAKE','CRYPTO_DEFI_LENDING') THEN
        pos.quantity_held * COALESCE(lp.current_price, lp_u.current_price, 0)

      WHEN a.asset_type = 'CASH_ARS' THEN
        pos.quantity_held / NULLIF(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_CRYPTO_NATIVE' THEN
        pos.quantity_held * COALESCE(lp.current_price, lp_u.current_price, 0)

      WHEN a.asset_type IN ('CASH_USD_MEP','CASH_CRYPTO_STABLE') THEN
        pos.quantity_held

      WHEN a.asset_type = 'CASH_USD_CCL' THEN
        pos.quantity_held

      ELSE
        pos.quantity_held
          * COALESCE(lp.current_price, lp_u.current_price, 0)
          / NULLIF(fx.fx_mep_today, 0)
    END AS market_value_usd,

    pos.realized_gain_loss_ars,
    pos.realized_gain_loss_usd,
    pos.total_income_received_ars,
    pos.total_income_received_usd,
    pos.first_purchase_date,
    pos.last_transaction_date

  FROM       public.positions  pos
  JOIN       public.portfolios p   ON pos.portfolio_id = p.id
  JOIN       public.clients    c   ON p.client_id      = c.id
  JOIN       public.assets     a   ON pos.asset_id     = a.id
  LEFT JOIN  latest_prices     lp  ON lp.asset_id   = pos.asset_id
  LEFT JOIN  latest_prices     lp_u ON lp_u.asset_id = a.underlying_asset_id
  CROSS JOIN latest_fx         fx

  WHERE pos.quantity_held > 0
    AND p.is_active = TRUE
)

SELECT
  portfolio_id,
  portfolio_name,
  custodian_name,
  custodian_type,
  client_id,
  client_name,

  asset_id,
  ticker,
  asset_name,
  asset_type,
  asset_currency,
  settlement_currency,
  current_residual_factor,
  is_stablecoin,
  blockchain_network,

  quantity_held,
  quantity_effective,

  current_price,
  previous_close,
  daily_change_pct,
  price_date,
  price_source,
  fx_mep_today,
  fx_ccl_today,
  fx_date,

  ppp_ars,
  total_cost_basis_ars,
  ppp_usd,
  total_cost_basis_usd,
  avg_fx_mep_at_cost,

  market_value_ars,
  market_value_usd,

  -- P&L no realizado
  market_value_ars - total_cost_basis_ars                        AS unrealized_pnl_ars,
  market_value_usd - total_cost_basis_usd                        AS unrealized_pnl_usd,
  (market_value_ars - total_cost_basis_ars)
    / NULLIF(total_cost_basis_ars, 0)                            AS unrealized_pnl_ars_pct,

  -- Descomposición FX vs precio
  total_cost_basis_usd
    * (fx_mep_today - COALESCE(avg_fx_mep_at_cost, fx_mep_today)) AS fx_gain_loss_ars,
  (market_value_ars - total_cost_basis_ars)
    - total_cost_basis_usd
      * (fx_mep_today - COALESCE(avg_fx_mep_at_cost, fx_mep_today)) AS price_gain_loss_ars,

  -- Variación del día (1D)
  CASE
    WHEN previous_close IS NOT NULL AND previous_close > 0 THEN
      quantity_held
        * (COALESCE(current_price, 0) - previous_close)
        * CASE
            WHEN asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP')
            THEN current_residual_factor
            ELSE 1
          END
    ELSE NULL
  END AS daily_pnl_ars,

  realized_gain_loss_ars,
  realized_gain_loss_usd,
  total_income_received_ars,
  total_income_received_usd,

  (market_value_ars - total_cost_basis_ars)
    + realized_gain_loss_ars
    + total_income_received_ars                                  AS total_return_ars,
  (market_value_usd - total_cost_basis_usd)
    + realized_gain_loss_usd
    + total_income_received_usd                                  AS total_return_usd,

  first_purchase_date,
  last_transaction_date,

  CASE
    WHEN quantity_held > 0
    THEN (total_cost_basis_ars * 1.00242) / quantity_held
    ELSE NULL
  END AS break_even_price_ars,

  CASE
    WHEN quantity_held > 0
    THEN (total_cost_basis_usd * 1.00242) / quantity_held
    ELSE NULL
  END AS break_even_price_usd,

  CASE
    WHEN quantity_held > 0 AND current_price > 0 THEN
      CASE
        WHEN asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
          current_price * current_residual_factor
            - (total_cost_basis_ars * 1.00242 / quantity_held)
        ELSE
          current_price - (total_cost_basis_ars * 1.00242 / quantity_held)
      END
    ELSE NULL
  END AS spread_vs_breakeven_ars,

  CASE
    WHEN quantity_held > 0 AND total_cost_basis_ars > 0 AND current_price > 0 THEN
      CASE
        WHEN asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
          (current_price * current_residual_factor
            - total_cost_basis_ars * 1.00242 / quantity_held)
          / (total_cost_basis_ars * 1.00242 / quantity_held)
        ELSE
          (current_price - total_cost_basis_ars * 1.00242 / quantity_held)
          / (total_cost_basis_ars * 1.00242 / quantity_held)
      END
    ELSE NULL
  END AS spread_vs_breakeven_pct

FROM base;


-- ── 4. Recrear client_aum_summary ─────────────────────────────────────────────
CREATE VIEW public.client_aum_summary AS
SELECT
  client_id,
  client_name,
  SUM(market_value_ars)        AS total_aum_ars,
  SUM(market_value_usd)        AS total_aum_usd,
  SUM(unrealized_pnl_ars)      AS total_unrealized_pnl_ars,
  SUM(unrealized_pnl_usd)      AS total_unrealized_pnl_usd,
  SUM(total_return_ars)        AS total_return_ars,
  SUM(total_return_usd)        AS total_return_usd,
  SUM(daily_pnl_ars)           AS total_daily_pnl_ars,
  COUNT(DISTINCT portfolio_id) AS portfolio_count
FROM  public.portfolio_valuation_unified
GROUP BY client_id, client_name;
