-- =============================================================================
-- MIGRACIÓN: Soporte DELETE en trigger de recálculo de posiciones
--
-- Problema: trigger_recalculate_position() usa NEW incondicionalmente.
-- En DELETE, NEW es NULL en PostgreSQL → error al acceder NEW.asset_id.
-- El trigger además solo cubría INSERT OR UPDATE.
--
-- Fix: usar OLD cuando TG_OP = 'DELETE', y agregar DELETE al trigger.
-- =============================================================================

SET search_path TO public;

-- Actualizar la función para manejar DELETE usando OLD
CREATE OR REPLACE FUNCTION public.trigger_recalculate_position()
RETURNS TRIGGER AS $trigger$
DECLARE
  v_portfolio_id UUID;
  v_asset_id     UUID;
  v_swap_asset   UUID;
  v_tx_type      TEXT;
BEGIN
  -- En DELETE usar OLD; en INSERT/UPDATE usar NEW
  IF TG_OP = 'DELETE' THEN
    v_portfolio_id := OLD.portfolio_id;
    v_asset_id     := OLD.asset_id;
    v_swap_asset   := OLD.swap_to_asset_id;
    v_tx_type      := OLD.transaction_type;
  ELSE
    v_portfolio_id := NEW.portfolio_id;
    v_asset_id     := NEW.asset_id;
    v_swap_asset   := NEW.swap_to_asset_id;
    v_tx_type      := NEW.transaction_type;
  END IF;

  IF v_asset_id IS NOT NULL THEN
    PERFORM public.recalculate_position(v_portfolio_id, v_asset_id);
  END IF;

  IF v_tx_type = 'SWAP_CRYPTO' AND v_swap_asset IS NOT NULL THEN
    PERFORM public.recalculate_position(v_portfolio_id, v_swap_asset);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;


-- Reemplazar el trigger para incluir DELETE
DROP TRIGGER IF EXISTS after_transaction_insert ON public.transactions;

CREATE TRIGGER after_transaction_change
  AFTER INSERT OR UPDATE OR DELETE
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_position();
