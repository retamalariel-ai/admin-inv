-- =============================================================================
-- MIGRACIÓN: Fix DEPOSITO y RETIRO en recalculate_position()
--
-- Problema: DEPOSITO y RETIRO son tipos de transacción válidos en el enum
-- transaction_type, pero recalculate_position() no tenía ninguna rama para
-- ellos. Al insertar una tx con transaction_type='DEPOSITO', el trigger
-- disparaba el recálculo pero v_qty no se modificaba → quantity_held = 0.
--
-- Fix:
--   · DEPOSITO → misma lógica que COMPRA / TRANSFERENCIA_IN
--               (suma qty + costo base; registra first_purchase_date)
--   · RETIRO   → misma lógica que VENTA / TRANSFERENCIA_OUT
--               (reduce qty; realiza ganancia/pérdida al PPP vigente)
-- =============================================================================

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.recalculate_position(
  p_portfolio_id UUID,
  p_asset_id     UUID
) RETURNS VOID AS $$
DECLARE
  v_qty              DECIMAL(36,18) := 0;
  v_cost_ars         DECIMAL(20,4)  := 0;
  v_cost_usd         DECIMAL(20,4)  := 0;
  v_sum_ars_compras  DECIMAL(20,4)  := 0;
  v_sum_usd_compras  DECIMAL(20,4)  := 0;
  v_realized_ars     DECIMAL(20,4)  := 0;
  v_realized_usd     DECIMAL(20,4)  := 0;
  v_income_ars       DECIMAL(20,4)  := 0;
  v_income_usd       DECIMAL(20,4)  := 0;
  v_ppp_ars          DECIMAL(20,8)  := 0;
  v_ppp_usd          DECIMAL(20,8)  := 0;
  v_first_date       DATE;
  v_last_date        DATE;
  v_net_ars          DECIMAL(20,4);
  v_net_usd          DECIMAL(20,4);
  v_fx_mep           DECIMAL(20,8);
  v_fx_ccl           DECIMAL(20,8);
  v_sold_ratio       DECIMAL(20,8);
  v_amort_ratio      DECIMAL(20,8);
  v_avg_fx_mep       DECIMAL(20,8);
  rec                RECORD;
BEGIN
  FOR rec IN
    SELECT transaction_type,
           quantity,
           net_amount,
           currency,
           trade_date,
           fx_rate_mep,
           fx_rate_ccl,
           fx_rate_oficial,
           crypto_price_usd,
           residual_factor_at_trade
    FROM   public.transactions
    WHERE  portfolio_id = p_portfolio_id
      AND  asset_id     = p_asset_id
      AND  is_cancelled = FALSE
    ORDER BY trade_date ASC, created_at ASC
  LOOP
    -- Paso 1: Resolver tipos de cambio
    v_fx_mep := COALESCE(rec.fx_rate_mep, rec.fx_rate_oficial, 1);
    v_fx_ccl := COALESCE(rec.fx_rate_ccl, rec.fx_rate_mep, rec.fx_rate_oficial, 1);

    -- Paso 2: Convertir net_amount a ARS y USD
    CASE rec.currency
      WHEN 'ARS' THEN
        v_net_ars := rec.net_amount;
        v_net_usd := CASE WHEN v_fx_mep > 0 THEN rec.net_amount / v_fx_mep ELSE 0 END;

      WHEN 'USD_MEP' THEN
        v_net_usd := rec.net_amount;
        v_net_ars := rec.net_amount * v_fx_mep;

      WHEN 'USD_CCL', 'USD_CABLE' THEN
        v_net_usd := rec.net_amount;
        v_net_ars := rec.net_amount * v_fx_ccl;

      WHEN 'USDT', 'USDC', 'DAI' THEN
        v_net_usd := rec.net_amount;
        v_net_ars := rec.net_amount * v_fx_mep;

      WHEN 'BTC', 'ETH', 'SOL', 'MATIC', 'BNB', 'ADA', 'CRYPTO_OTHER' THEN
        v_net_usd := rec.quantity * COALESCE(rec.crypto_price_usd, 0);
        v_net_ars := v_net_usd * v_fx_mep;

      ELSE
        v_net_ars := rec.net_amount;
        v_net_usd := CASE WHEN v_fx_mep > 0 THEN rec.net_amount / v_fx_mep ELSE 0 END;
    END CASE;

    -- Paso 3: Lógica contable por tipo de transacción

    IF rec.transaction_type IN (
      'COMPRA', 'SUSCRIPCION_FCI', 'TRANSFERENCIA_IN', 'BRIDGE_IN',
      'DEPOSITO'   -- Depósito crypto: aumenta qty y costo base igual que una compra
    ) THEN
      v_cost_ars        := v_cost_ars + v_net_ars;
      v_cost_usd        := v_cost_usd + v_net_usd;
      v_qty             := v_qty + rec.quantity;
      v_sum_ars_compras := v_sum_ars_compras + v_net_ars;
      v_sum_usd_compras := v_sum_usd_compras + v_net_usd;
      IF v_first_date IS NULL THEN
        v_first_date := rec.trade_date;
      END IF;

    ELSIF rec.transaction_type IN (
      'VENTA', 'RESCATE_FCI', 'TRANSFERENCIA_OUT', 'BRIDGE_OUT',
      'RETIRO'     -- Retiro crypto: reduce qty y realiza P&L al PPP vigente
    ) THEN
      v_ppp_ars      := CASE WHEN v_qty > 0 THEN v_cost_ars / v_qty ELSE 0 END;
      v_ppp_usd      := CASE WHEN v_qty > 0 THEN v_cost_usd / v_qty ELSE 0 END;
      v_realized_ars := v_realized_ars + v_net_ars - (v_ppp_ars * rec.quantity);
      v_realized_usd := v_realized_usd + v_net_usd - (v_ppp_usd * rec.quantity);
      v_cost_ars     := v_cost_ars - (v_ppp_ars * rec.quantity);
      v_cost_usd     := v_cost_usd - (v_ppp_usd * rec.quantity);
      v_qty          := v_qty - rec.quantity;
      v_sold_ratio      := CASE WHEN (v_qty + rec.quantity) > 0
                             THEN rec.quantity / (v_qty + rec.quantity)
                             ELSE 0 END;
      v_sum_ars_compras := v_sum_ars_compras * (1 - v_sold_ratio);
      v_sum_usd_compras := v_sum_usd_compras * (1 - v_sold_ratio);

    ELSIF rec.transaction_type = 'AMORTIZACION' THEN
      v_amort_ratio  := CASE WHEN v_qty > 0 THEN rec.quantity / v_qty ELSE 0 END;
      v_income_ars   := v_income_ars + v_net_ars;
      v_income_usd   := v_income_usd + v_net_usd;
      v_realized_ars := v_realized_ars + v_net_ars - (v_cost_ars * v_amort_ratio);
      v_realized_usd := v_realized_usd + v_net_usd - (v_cost_usd * v_amort_ratio);
      v_cost_ars     := v_cost_ars - (v_cost_ars * v_amort_ratio);
      v_cost_usd     := v_cost_usd - (v_cost_usd * v_amort_ratio);

    ELSIF rec.transaction_type IN ('RENTA', 'DIVIDENDO') THEN
      v_income_ars := v_income_ars + v_net_ars;
      v_income_usd := v_income_usd + v_net_usd;

    ELSIF rec.transaction_type IN ('INTERES_EARN', 'REWARD_DEFI') THEN
      v_qty        := v_qty + rec.quantity;
      v_income_ars := v_income_ars + v_net_ars;
      v_income_usd := v_income_usd + v_net_usd;

    ELSIF rec.transaction_type = 'FEE_CADENA' THEN
      v_qty      := v_qty - rec.quantity;
      v_cost_ars := v_cost_ars + v_net_ars;
      v_cost_usd := v_cost_usd + v_net_usd;

    ELSIF rec.transaction_type = 'SPLIT_ACCION' THEN
      v_qty := rec.quantity;

    ELSIF rec.transaction_type = 'CANJE' THEN
      v_realized_ars    := v_realized_ars + v_net_ars - v_cost_ars;
      v_realized_usd    := v_realized_usd + v_net_usd - v_cost_usd;
      v_cost_ars        := 0;
      v_cost_usd        := 0;
      v_qty             := 0;
      v_sum_ars_compras := 0;
      v_sum_usd_compras := 0;

    -- FEE_EXCHANGE, COMISION_ALYCE, AJUSTE_PRECIO: solo informativo, no afectan posición
    END IF;

    v_last_date := rec.trade_date;

  END LOOP;

  v_qty      := GREATEST(0, v_qty);
  v_cost_ars := GREATEST(0, v_cost_ars);
  v_cost_usd := GREATEST(0, v_cost_usd);

  v_ppp_ars := CASE WHEN v_qty > 0 THEN v_cost_ars / v_qty ELSE 0 END;
  v_ppp_usd := CASE WHEN v_qty > 0 THEN v_cost_usd / v_qty ELSE 0 END;

  v_avg_fx_mep := CASE WHEN v_sum_usd_compras > 0
                    THEN v_sum_ars_compras / v_sum_usd_compras
                    ELSE NULL END;

  INSERT INTO public.positions (
    portfolio_id,
    asset_id,
    quantity_held,
    average_cost_price_ars,
    total_cost_basis_ars,
    average_cost_price_usd,
    total_cost_basis_usd,
    avg_fx_mep_at_cost,
    realized_gain_loss_ars,
    realized_gain_loss_usd,
    total_income_received_ars,
    total_income_received_usd,
    first_purchase_date,
    last_transaction_date,
    last_updated
  ) VALUES (
    p_portfolio_id,
    p_asset_id,
    v_qty,
    v_ppp_ars,
    v_cost_ars,
    v_ppp_usd,
    v_cost_usd,
    v_avg_fx_mep,
    v_realized_ars,
    v_realized_usd,
    v_income_ars,
    v_income_usd,
    v_first_date,
    v_last_date,
    NOW()
  )
  ON CONFLICT (portfolio_id, asset_id) DO UPDATE SET
    quantity_held             = EXCLUDED.quantity_held,
    average_cost_price_ars    = EXCLUDED.average_cost_price_ars,
    total_cost_basis_ars      = EXCLUDED.total_cost_basis_ars,
    average_cost_price_usd    = EXCLUDED.average_cost_price_usd,
    total_cost_basis_usd      = EXCLUDED.total_cost_basis_usd,
    avg_fx_mep_at_cost        = EXCLUDED.avg_fx_mep_at_cost,
    realized_gain_loss_ars    = EXCLUDED.realized_gain_loss_ars,
    realized_gain_loss_usd    = EXCLUDED.realized_gain_loss_usd,
    total_income_received_ars = EXCLUDED.total_income_received_ars,
    total_income_received_usd = EXCLUDED.total_income_received_usd,
    first_purchase_date       = COALESCE(
                                  positions.first_purchase_date,
                                  EXCLUDED.first_purchase_date
                                ),
    last_transaction_date     = EXCLUDED.last_transaction_date,
    last_updated              = NOW();

END;
$$ LANGUAGE plpgsql;
