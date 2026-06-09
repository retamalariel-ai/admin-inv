-- =============================================================================
-- MIGRACIÓN 006: Vistas de valuación
-- Orden de ejecución: 6 de 7
-- Descripción: Define portfolio_valuation_unified (vista principal de valuación
--              a mercado con P&L desglosado) y client_aum_summary (resumen
--              de AUM y retorno por cliente).
-- Requisito previo: 001_enums.sql — 005_functions_triggers.sql
-- Schema destino: public
-- Supuesto de precios:
--   · Bonos: price_quotes.price es precio por VN 1 (ej: 1241.90 ARS = precio por 1 VN nominal)
--   · Acciones, CEDEARs, FCI: price_quotes.price es en ARS por unidad
--   · Cripto: price_quotes.price es en USD por unidad
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- VISTA PRINCIPAL: public.portfolio_valuation_unified
--
-- Estructura en tres capas:
--   1. latest_prices CTE  — último precio disponible por activo
--   2. latest_fx CTE      — tipo de cambio más reciente
--   3. base CTE           — valuación con market_value_ars y market_value_usd
--   4. SELECT final       — agrega P&L, descomposición cambiaria y retorno total
-- =============================================================================
CREATE VIEW public.portfolio_valuation_unified AS
WITH

-- -----------------------------------------------------------------------------
-- CTE 1: Último precio disponible por activo
-- DISTINCT ON con el índice idx_quotes_asset_date_desc garantiza que no haya
-- seqscan sobre price_quotes incluso con millones de registros.
-- -----------------------------------------------------------------------------
latest_prices AS (
  SELECT DISTINCT ON (asset_id)
    asset_id,
    price      AS current_price,
    currency   AS price_currency,
    quote_date AS price_date,
    source     AS price_source
  FROM  public.price_quotes
  ORDER BY asset_id, quote_date DESC, quote_time DESC NULLS LAST
),

-- -----------------------------------------------------------------------------
-- CTE 2: Tipo de cambio más reciente
-- CROSS JOIN en la query principal: si fx_rates está vacío, la vista devuelve
-- 0 filas. Para uso en producción siempre debe haber al menos una fila.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- CTE 3: Valuación base
-- Combina posiciones, activos, clientes, precios y FX.
-- Calcula market_value_ars y market_value_usd en este nivel para poder
-- referenciarlos como columnas en el SELECT final.
-- -----------------------------------------------------------------------------
base AS (
  SELECT
    -- Identificadores de cuenta y cliente
    p.id            AS portfolio_id,
    p.name          AS portfolio_name,
    p.custodian_name,
    p.custodian_type,
    c.id            AS client_id,
    c.full_name     AS client_name,

    -- Datos del activo
    a.id            AS asset_id,
    a.ticker,
    a.name          AS asset_name,
    a.asset_type,
    a.currency      AS asset_currency,
    a.settlement_currency,
    a.current_residual_factor,
    a.is_stablecoin,
    a.blockchain_network,

    -- Posición
    pos.quantity_held,
    pos.quantity_held * a.current_residual_factor AS quantity_effective,

    -- Precios y FX actuales
    lp.current_price,
    lp.price_date,
    lp.price_source,
    fx.fx_mep_today,
    fx.fx_ccl_today,
    fx.fx_date,

    -- Costo base (alias legibles para el consumidor de la vista)
    pos.average_cost_price_ars  AS ppp_ars,
    pos.total_cost_basis_ars,
    pos.average_cost_price_usd  AS ppp_usd,
    pos.total_cost_basis_usd,
    pos.avg_fx_mep_at_cost,

    -- -------------------------------------------------------------------------
    -- market_value_ars: valuación a mercado en pesos
    -- Bonos: se usa price_quotes.currency (no assets.currency).
    --   Ej: GD38 tiene asset.currency='USD_CCL' pero cotiza en ARS en BYMA.
    -- Acciones/FCI: precio es ARS/unidad → qty * price
    -- Cripto: precio es USD/unidad → qty * price * fx_mep
    -- Cash: la cantidad ES el valor en su moneda
    -- -------------------------------------------------------------------------
    CASE
      WHEN a.asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
        CASE
          WHEN lp.price_currency = 'ARS' THEN
            pos.quantity_held
              * COALESCE(lp.current_price, 0)
              * a.current_residual_factor
          WHEN lp.price_currency IN ('USD_MEP','USD_CCL','USD_CABLE') THEN
            pos.quantity_held
              * COALESCE(lp.current_price, 0)
              * a.current_residual_factor
              * COALESCE(fx.fx_mep_today, 0)
          ELSE
            CASE
              WHEN a.currency = 'ARS' THEN
                pos.quantity_held
                  * COALESCE(lp.current_price, 0)
                  * a.current_residual_factor
              ELSE
                pos.quantity_held
                  * COALESCE(lp.current_price, 0)
                  * a.current_residual_factor
                  * COALESCE(fx.fx_mep_today, 0)
            END
        END

      WHEN a.asset_type IN ('ACCION_LOCAL','CEDEAR',
           'FCI_MONEY_MARKET','FCI_RENTA_FIJA',
           'FCI_RENTA_VARIABLE','FCI_RENTA_MIXTA') THEN
        pos.quantity_held * COALESCE(lp.current_price, 0)

      WHEN a.asset_type IN ('CRYPTO_SPOT','CRYPTO_STABLECOIN','CRYPTO_EARN',
           'CRYPTO_DEFI_LP','CRYPTO_DEFI_STAKE','CRYPTO_DEFI_LENDING') THEN
        pos.quantity_held * COALESCE(lp.current_price, 0) * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_ARS' THEN
        pos.quantity_held

      WHEN a.asset_type = 'CASH_CRYPTO_NATIVE' THEN
        pos.quantity_held
          * COALESCE(lp.current_price, 0)
          * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type IN ('CASH_USD_MEP','CASH_CRYPTO_STABLE') THEN
        pos.quantity_held * COALESCE(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_USD_CCL' THEN
        pos.quantity_held * COALESCE(fx.fx_ccl_today, 0)

      ELSE
        pos.quantity_held * COALESCE(lp.current_price, 0)
    END AS market_value_ars,

    -- -------------------------------------------------------------------------
    -- market_value_usd: valuación a mercado en dólares
    -- Activos ARS: dividir por fx_mep (con NULLIF anticrash)
    -- Activos USD/Cripto: calcular directo sin pasar por ARS
    -- -------------------------------------------------------------------------
    CASE
      WHEN a.asset_type IN ('BONO_SOBERANO','BONO_SUBSOBERANO','ON','LETES','LECAP') THEN
        CASE
          WHEN lp.price_currency = 'ARS' THEN
            pos.quantity_held
              * COALESCE(lp.current_price, 0)
              * a.current_residual_factor
              / NULLIF(fx.fx_mep_today, 0)
          WHEN lp.price_currency IN ('USD_MEP','USD_CCL','USD_CABLE') THEN
            pos.quantity_held
              * COALESCE(lp.current_price, 0)
              * a.current_residual_factor
          ELSE
            pos.quantity_held
              * COALESCE(lp.current_price, 0)
              * a.current_residual_factor
              / NULLIF(fx.fx_mep_today, 0)
        END

      WHEN a.asset_type IN ('ACCION_LOCAL','CEDEAR',
           'FCI_MONEY_MARKET','FCI_RENTA_FIJA',
           'FCI_RENTA_VARIABLE','FCI_RENTA_MIXTA') THEN
        pos.quantity_held
          * COALESCE(lp.current_price, 0)
          / NULLIF(fx.fx_mep_today, 0)

      WHEN a.asset_type IN ('CRYPTO_SPOT','CRYPTO_STABLECOIN','CRYPTO_EARN',
           'CRYPTO_DEFI_LP','CRYPTO_DEFI_STAKE','CRYPTO_DEFI_LENDING') THEN
        -- Precio ya en USD: no convertir
        pos.quantity_held * COALESCE(lp.current_price, 0)

      WHEN a.asset_type = 'CASH_ARS' THEN
        pos.quantity_held / NULLIF(fx.fx_mep_today, 0)

      WHEN a.asset_type = 'CASH_CRYPTO_NATIVE' THEN
        pos.quantity_held * COALESCE(lp.current_price, 0)

      WHEN a.asset_type IN ('CASH_USD_MEP','CASH_CRYPTO_STABLE') THEN
        pos.quantity_held

      WHEN a.asset_type = 'CASH_USD_CCL' THEN
        pos.quantity_held

      ELSE
        pos.quantity_held
          * COALESCE(lp.current_price, 0)
          / NULLIF(fx.fx_mep_today, 0)
    END AS market_value_usd,

    -- Datos para P&L (pasados al SELECT final)
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
  LEFT JOIN  latest_prices     lp  ON lp.asset_id      = pos.asset_id
  CROSS JOIN latest_fx         fx

  WHERE pos.quantity_held > 0
    AND p.is_active = TRUE
)

-- =============================================================================
-- SELECT FINAL: agrega P&L, descomposición FX vs precio y retorno total
-- =============================================================================
SELECT
  -- Identificadores
  portfolio_id,
  portfolio_name,
  custodian_name,
  custodian_type,
  client_id,
  client_name,

  -- Datos del activo
  asset_id,
  ticker,
  asset_name,
  asset_type,
  asset_currency,
  settlement_currency,
  current_residual_factor,
  is_stablecoin,
  blockchain_network,

  -- Posición
  quantity_held,
  quantity_effective,

  -- Precios y FX actuales
  current_price,
  price_date,
  price_source,
  fx_mep_today,
  fx_ccl_today,
  fx_date,

  -- Costo base
  ppp_ars,
  total_cost_basis_ars,
  ppp_usd,
  total_cost_basis_usd,
  avg_fx_mep_at_cost,

  -- Valuación a mercado
  market_value_ars,
  market_value_usd,

  -- P&L no realizado
  market_value_ars - total_cost_basis_ars                        AS unrealized_pnl_ars,
  market_value_usd - total_cost_basis_usd                        AS unrealized_pnl_usd,
  (market_value_ars - total_cost_basis_ars)
    / NULLIF(total_cost_basis_ars, 0)                            AS unrealized_pnl_ars_pct,

  -- Descomposición de la ganancia no realizada en ARS:
  --   fx_gain_loss_ars    = ganancia por variación del MEP desde la compra
  --   price_gain_loss_ars = ganancia de precio pura (excluye efecto cambiario)
  -- Si avg_fx_mep_at_cost es NULL (activo recibido sin costo), se asume
  -- MEP al costo = MEP de hoy → fx_gain_loss_ars = 0 (correcto semánticamente).
  total_cost_basis_usd
    * (fx_mep_today - COALESCE(avg_fx_mep_at_cost, fx_mep_today)) AS fx_gain_loss_ars,
  (market_value_ars - total_cost_basis_ars)
    - total_cost_basis_usd
      * (fx_mep_today - COALESCE(avg_fx_mep_at_cost, fx_mep_today)) AS price_gain_loss_ars,

  -- Resultados realizados e ingresos acumulados
  realized_gain_loss_ars,
  realized_gain_loss_usd,
  total_income_received_ars,
  total_income_received_usd,

  -- Retorno total (no realizado + realizado + ingresos)
  (market_value_ars - total_cost_basis_ars)
    + realized_gain_loss_ars
    + total_income_received_ars                                  AS total_return_ars,
  (market_value_usd - total_cost_basis_usd)
    + realized_gain_loss_usd
    + total_income_received_usd                                  AS total_return_usd,

  -- Fechas de referencia
  first_purchase_date,
  last_transaction_date,

  -- Break-even: precio mínimo de venta para recuperar la inversión
  -- (incluye comisión de salida 0.20% × 1.21 IVA = 0.242%)
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

  -- Diferencia entre precio actual y break-even (en ARS por unidad)
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

  -- Diferencia en % respecto al break-even
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


-- =============================================================================
-- VISTA SECUNDARIA: public.client_aum_summary
--
-- Resumen por cliente: AUM total, P&L no realizado, retorno total y cantidad
-- de portfolios activos. Consume portfolio_valuation_unified.
-- =============================================================================
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
  COUNT(DISTINCT portfolio_id) AS portfolio_count
FROM  public.portfolio_valuation_unified
GROUP BY client_id, client_name;
