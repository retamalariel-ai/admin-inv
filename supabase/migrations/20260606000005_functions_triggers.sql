-- =============================================================================
-- MIGRACIÓN 005: Funciones y triggers
-- Orden de ejecución: 5 de 7
-- Descripción: Define recalculate_position() que recalcula desde cero la
--              posición acumulada de un activo en un portfolio iterando todas
--              sus transacciones vigentes en orden cronológico estricto.
--              El trigger after_transaction_insert la invoca automáticamente
--              después de cada INSERT o UPDATE en transactions.
-- Requisito previo: 001_enums.sql — 004_indexes.sql
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- FUNCIÓN: public.recalculate_position(p_portfolio_id, p_asset_id)
--
-- Itera el log de transacciones vigentes de un portfolio/activo y aplica
-- la lógica contable de cada tipo para acumular:
--   · Cantidad en cartera (v_qty)
--   · Costo base en ARS y USD usando PPP (precio promedio ponderado)
--   · Ganancia/pérdida realizada
--   · Ingresos recibidos (rentas, dividendos, rewards)
--   · MEP promedio ponderado al costo (para aislar ganancia cambiaria)
-- Al finalizar hace UPSERT en public.positions.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_position(
  p_portfolio_id UUID,
  p_asset_id     UUID
) RETURNS VOID AS $$
DECLARE
  -- Acumuladores de posición y costo base
  v_qty              DECIMAL(36,18) := 0;
  v_cost_ars         DECIMAL(20,4)  := 0;
  v_cost_usd         DECIMAL(20,4)  := 0;

  -- Acumuladores para calcular el MEP promedio ponderado al costo
  v_sum_ars_compras  DECIMAL(20,4)  := 0;
  v_sum_usd_compras  DECIMAL(20,4)  := 0;

  -- Resultado realizado e ingresos acumulados históricamente
  v_realized_ars     DECIMAL(20,4)  := 0;
  v_realized_usd     DECIMAL(20,4)  := 0;
  v_income_ars       DECIMAL(20,4)  := 0;
  v_income_usd       DECIMAL(20,4)  := 0;

  -- PPP calculados en cada venta y al finalizar el loop
  v_ppp_ars          DECIMAL(20,8)  := 0;
  v_ppp_usd          DECIMAL(20,8)  := 0;

  -- Fechas de referencia para el registro de posición
  v_first_date       DATE;
  v_last_date        DATE;

  -- Variables de resolución de moneda por iteración
  v_net_ars          DECIMAL(20,4);
  v_net_usd          DECIMAL(20,4);
  v_fx_mep           DECIMAL(20,8);
  v_fx_ccl           DECIMAL(20,8);

  -- Auxiliares para cálculos intermedios en VENTA y AMORTIZACION
  v_sold_ratio       DECIMAL(20,8);  -- Proporción vendida sobre posición pre-venta
  v_amort_ratio      DECIMAL(20,8);  -- Proporción del VN amortizada en el pago

  -- Resultado final del MEP promedio ponderado al costo
  v_avg_fx_mep       DECIMAL(20,8);

  rec                RECORD;
BEGIN
  -- -------------------------------------------------------------------------
  -- Iteración cronológica estricta sobre el log de transacciones vigentes.
  -- El índice idx_tx_portfolio_asset_date cubre este WHERE + ORDER BY.
  -- -------------------------------------------------------------------------
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
    -- -----------------------------------------------------------------------
    -- Paso 1: Resolver tipos de cambio desde el snapshot de la transacción.
    -- Se usa fx_oficial como último fallback para evitar divisiones por cero
    -- en transacciones ARS sin MEP cargado (ej: depósitos históricos).
    -- -----------------------------------------------------------------------
    v_fx_mep := COALESCE(rec.fx_rate_mep, rec.fx_rate_oficial, 1);
    v_fx_ccl := COALESCE(rec.fx_rate_ccl, rec.fx_rate_mep, rec.fx_rate_oficial, 1);

    -- -----------------------------------------------------------------------
    -- Paso 2: Convertir net_amount a ARS y USD según moneda de la transacción.
    -- -----------------------------------------------------------------------
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
        -- Stablecoins: se tratan 1:1 con USD a efectos de P&L
        v_net_usd := rec.net_amount;
        v_net_ars := rec.net_amount * v_fx_mep;

      WHEN 'BTC', 'ETH', 'SOL', 'MATIC', 'BNB', 'ADA', 'CRYPTO_OTHER' THEN
        -- Cripto: el valor en USD proviene del precio snapshot guardado en la tx
        v_net_usd := rec.quantity * COALESCE(rec.crypto_price_usd, 0);
        v_net_ars := v_net_usd * v_fx_mep;

      ELSE
        -- Fallback conservador: tratar como ARS
        v_net_ars := rec.net_amount;
        v_net_usd := CASE WHEN v_fx_mep > 0 THEN rec.net_amount / v_fx_mep ELSE 0 END;
    END CASE;

    -- -----------------------------------------------------------------------
    -- Paso 3: Aplicar lógica contable según tipo de transacción.
    -- -----------------------------------------------------------------------

    IF rec.transaction_type IN ('COMPRA', 'SUSCRIPCION_FCI', 'TRANSFERENCIA_IN', 'BRIDGE_IN') THEN
      -- Entrada de activo: acumula costo base y posición
      v_cost_ars        := v_cost_ars + v_net_ars;
      v_cost_usd        := v_cost_usd + v_net_usd;
      v_qty             := v_qty + rec.quantity;
      v_sum_ars_compras := v_sum_ars_compras + v_net_ars;
      v_sum_usd_compras := v_sum_usd_compras + v_net_usd;
      IF v_first_date IS NULL THEN
        v_first_date := rec.trade_date;
      END IF;

    ELSIF rec.transaction_type IN ('VENTA', 'RESCATE_FCI', 'TRANSFERENCIA_OUT', 'BRIDGE_OUT') THEN
      -- Salida de activo: realiza ganancia/pérdida al PPP vigente antes de la venta
      v_ppp_ars      := CASE WHEN v_qty > 0 THEN v_cost_ars / v_qty ELSE 0 END;
      v_ppp_usd      := CASE WHEN v_qty > 0 THEN v_cost_usd / v_qty ELSE 0 END;
      v_realized_ars := v_realized_ars + v_net_ars - (v_ppp_ars * rec.quantity);
      v_realized_usd := v_realized_usd + v_net_usd - (v_ppp_usd * rec.quantity);
      v_cost_ars     := v_cost_ars - (v_ppp_ars * rec.quantity);
      v_cost_usd     := v_cost_usd - (v_ppp_usd * rec.quantity);
      v_qty          := v_qty - rec.quantity;
      -- Ajuste proporcional de acumulados FX sobre la porción remanente.
      -- v_qty ya fue reducido: (v_qty + rec.quantity) reconstruye la posición pre-venta.
      v_sold_ratio      := CASE WHEN (v_qty + rec.quantity) > 0
                             THEN rec.quantity / (v_qty + rec.quantity)
                             ELSE 0 END;
      v_sum_ars_compras := v_sum_ars_compras * (1 - v_sold_ratio);
      v_sum_usd_compras := v_sum_usd_compras * (1 - v_sold_ratio);

    ELSIF rec.transaction_type = 'AMORTIZACION' THEN
      -- Pago de capital: reduce el costo base sin modificar la cantidad de VN en cartera.
      -- La ganancia = monto cobrado − porción proporcional del costo base amortizada.
      v_amort_ratio  := CASE WHEN v_qty > 0 THEN rec.quantity / v_qty ELSE 0 END;
      v_income_ars   := v_income_ars + v_net_ars;
      v_income_usd   := v_income_usd + v_net_usd;
      v_realized_ars := v_realized_ars + v_net_ars - (v_cost_ars * v_amort_ratio);
      v_realized_usd := v_realized_usd + v_net_usd - (v_cost_usd * v_amort_ratio);
      v_cost_ars     := v_cost_ars - (v_cost_ars * v_amort_ratio);
      v_cost_usd     := v_cost_usd - (v_cost_usd * v_amort_ratio);
      -- v_qty NO cambia: el valor nominal del bono no varía con los pagos de capital

    ELSIF rec.transaction_type IN ('RENTA', 'DIVIDENDO') THEN
      -- Ingreso puro: no toca cantidad ni costo base
      v_income_ars := v_income_ars + v_net_ars;
      v_income_usd := v_income_usd + v_net_usd;

    ELSIF rec.transaction_type IN ('INTERES_EARN', 'REWARD_DEFI') THEN
      -- Interés o reward: aumenta la cantidad con costo base = 0.
      -- Efecto "dilución del PPP": el precio promedio baja a medida que se acumulan rewards.
      v_qty        := v_qty + rec.quantity;
      v_income_ars := v_income_ars + v_net_ars;
      v_income_usd := v_income_usd + v_net_usd;

    ELSIF rec.transaction_type = 'FEE_CADENA' THEN
      -- Gas consumido on-chain: reduce la cantidad y capitaliza el fee al costo base
      v_qty      := v_qty - rec.quantity;
      v_cost_ars := v_cost_ars + v_net_ars;
      v_cost_usd := v_cost_usd + v_net_usd;

    ELSIF rec.transaction_type = 'SPLIT_ACCION' THEN
      -- Split / reverse split: quantity en la tx = nueva cantidad TOTAL post-evento.
      -- El costo base total no cambia; el nuevo PPP resulta del recálculo post-loop.
      v_qty := rec.quantity;

    ELSIF rec.transaction_type = 'CANJE' THEN
      -- Canje / reestructuración: cierra la posición realizando toda la ganancia
      -- o pérdida acumulada y resetea todos los acumuladores.
      v_realized_ars    := v_realized_ars + v_net_ars - v_cost_ars;
      v_realized_usd    := v_realized_usd + v_net_usd - v_cost_usd;
      v_cost_ars        := 0;
      v_cost_usd        := 0;
      v_qty             := 0;
      v_sum_ars_compras := 0;
      v_sum_usd_compras := 0;

    END IF;

    v_last_date := rec.trade_date;

  END LOOP;

  -- -------------------------------------------------------------------------
  -- Post-loop: sanitizar negativos residuales por redondeo acumulado
  -- -------------------------------------------------------------------------
  v_qty      := GREATEST(0, v_qty);
  v_cost_ars := GREATEST(0, v_cost_ars);
  v_cost_usd := GREATEST(0, v_cost_usd);

  -- PPP finales vigentes (precio promedio ponderado de compra)
  v_ppp_ars := CASE WHEN v_qty > 0 THEN v_cost_ars / v_qty ELSE 0 END;
  v_ppp_usd := CASE WHEN v_qty > 0 THEN v_cost_usd / v_qty ELSE 0 END;

  -- MEP promedio ponderado al costo: permite separar ganancia cambiaria
  -- (variación del tipo de cambio desde la compra) de ganancia de precio pura
  v_avg_fx_mep := CASE WHEN v_sum_usd_compras > 0
                    THEN v_sum_ars_compras / v_sum_usd_compras
                    ELSE NULL END;

  -- -------------------------------------------------------------------------
  -- UPSERT en positions.
  -- first_purchase_date se preserva con COALESCE para no sobreescribir
  -- la fecha original si el recálculo la devuelve NULL (posición en cero).
  -- -------------------------------------------------------------------------
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


-- =============================================================================
-- FUNCIÓN DE TRIGGER: public.trigger_recalculate_position()
--
-- Invocada por after_transaction_insert en cada INSERT o UPDATE sobre
-- transactions. El UPDATE cubre el caso de cancelación: cuando se setea
-- is_cancelled = TRUE, la posición se recalcula excluyendo ese registro.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.trigger_recalculate_position()
RETURNS TRIGGER AS $trigger$
BEGIN
  -- Recalcular posición del activo principal de la transacción
  IF NEW.asset_id IS NOT NULL THEN
    PERFORM public.recalculate_position(NEW.portfolio_id, NEW.asset_id);
  END IF;

  -- En SWAP_CRYPTO recalcular también el activo destino del intercambio
  IF NEW.transaction_type = 'SWAP_CRYPTO' AND NEW.swap_to_asset_id IS NOT NULL THEN
    PERFORM public.recalculate_position(NEW.portfolio_id, NEW.swap_to_asset_id);
  END IF;

  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;


-- =============================================================================
-- TRIGGER: after_transaction_insert
--
-- Dispara AFTER INSERT (nueva operación) y AFTER UPDATE (cancelación lógica).
-- FOR EACH ROW garantiza que cada transacción individual dispara su propio
-- recálculo, incluso en bulk inserts.
-- =============================================================================
CREATE TRIGGER after_transaction_insert
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_position();
