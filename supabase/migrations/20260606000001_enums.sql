-- =============================================================================
-- MIGRACIÓN 001: ENUMs del dominio financiero
-- Orden de ejecución: 1 de 7
-- Descripción: Define todos los tipos enumerados usados en el esquema.
--              Deben existir antes de crear cualquier tabla que los referencie.
-- Schema destino: public (único schema de la aplicación)
-- =============================================================================

SET search_path TO public;

-- -----------------------------------------------------------------------------
-- asset_type: Clasifica cada instrumento financiero por categoría de mercado
-- -----------------------------------------------------------------------------
CREATE TYPE public.asset_type AS ENUM (
  -- Mercado de Capitales Argentino (ALyC)
  'ACCION_LOCAL',         -- Acciones que cotizan en BYMA (ej: GGAL, YPF)
  'CEDEAR',               -- Certificados de Depósito Argentinos (ej: AAPL, MSFT)
  'BONO_SOBERANO',        -- Bonos del Tesoro Nacional (ej: AL30, GD30)
  'BONO_SUBSOBERANO',     -- Bonos provinciales o municipales
  'ON',                   -- Obligaciones Negociables (deuda corporativa)
  'LETES',                -- Letras del Tesoro en dólares
  'LECAP',                -- Letras de Capitalización en ARS
  'FCI_MONEY_MARKET',     -- Fondos de inversión T+0 (ej: Premier Renta)
  'FCI_RENTA_FIJA',       -- Fondos de renta fija
  'FCI_RENTA_VARIABLE',   -- Fondos de renta variable
  'FCI_RENTA_MIXTA',      -- Fondos mixtos

  -- Criptoactivos
  'CRYPTO_SPOT',          -- Tenencia directa en exchange o wallet (ej: BTC, ETH)
  'CRYPTO_STABLECOIN',    -- Stablecoins (USDT, USDC, DAI)
  'CRYPTO_EARN',          -- Posición en producto de rendimiento centralizado (Binance Earn, Nexo)
  'CRYPTO_DEFI_LP',       -- Posición en pool de liquidez DeFi (Uniswap, Curve)
  'CRYPTO_DEFI_STAKE',    -- Staking en protocolo DeFi (Lido stETH, Marinade mSOL)
  'CRYPTO_DEFI_LENDING',  -- Préstamo en protocolo DeFi (Aave, Compound)

  -- Cash / Saldos disponibles
  'CASH_ARS',             -- Saldo en pesos argentinos
  'CASH_USD_MEP',         -- Saldo en dólares MEP (tipo de cambio bursátil)
  'CASH_USD_CCL',         -- Saldo en dólares CCL / Cable
  'CASH_CRYPTO_STABLE',   -- Saldo en stablecoin (1:1 USD a efectos de valuación)
  'CASH_CRYPTO_NATIVE'    -- Saldo en cripto nativa (sin posición abierta)
);

-- -----------------------------------------------------------------------------
-- currency: Monedas y activos que funcionan como unidad de denominación
-- -----------------------------------------------------------------------------
CREATE TYPE public.currency AS ENUM (
  -- Monedas fiat argentinas y dólares con brecha
  'ARS',          -- Peso argentino
  'USD_MEP',      -- Dólar MEP (bursátil, liquidación local)
  'USD_CCL',      -- Dólar Contado con Liquidación (liquidación offshore)
  'USD_CABLE',    -- Dólar transferencia bancaria internacional
  'USD_OFICIAL',  -- Dólar oficial (tipo de cambio del BCRA)
  'USD_BLUE',     -- Dólar blue / paralelo (referencia, no operable en ALyC)

  -- Criptomonedas principales
  'BTC',          -- Bitcoin
  'ETH',          -- Ethereum
  'SOL',          -- Solana
  'USDT',         -- Tether
  'USDC',         -- USD Coin
  'DAI',          -- DAI (stablecoin descentralizada)
  'MATIC',        -- Polygon
  'BNB',          -- Binance Coin
  'ADA',          -- Cardano
  'CRYPTO_OTHER'  -- Otras criptomonedas no listadas explícitamente
);

-- -----------------------------------------------------------------------------
-- transaction_type: Todos los tipos de movimiento registrables en el log
-- -----------------------------------------------------------------------------
CREATE TYPE public.transaction_type AS ENUM (
  -- Operaciones de mercado de capitales
  'COMPRA',              -- Compra de instrumento (genera costo base)
  'VENTA',               -- Venta de instrumento (realiza ganancia/pérdida)
  'SUSCRIPCION_FCI',     -- Suscripción a cuotapartes de FCI
  'RESCATE_FCI',         -- Rescate de cuotapartes de FCI
  'DIVIDENDO',           -- Cobro de dividendo en acciones / CEDEARs
  'RENTA',               -- Cobro de renta / cupón de bono
  'AMORTIZACION',        -- Pago de amortización de capital (reduce VN)
  'CANJE',               -- Canje / reestructuración (cierra posición y abre nueva)
  'SPLIT_ACCION',        -- Split o reverse split de acciones

  -- Operaciones cripto centralizadas
  'INTERES_EARN',        -- Interés acreditado en producto Earn / Staking CEX
  'SWAP_CRYPTO',         -- Intercambio cripto-cripto en exchange (un solo registro bilateral)
  'DEPOSITO',            -- Depósito de fondos (fiat → exchange o wallet → wallet)
  'RETIRO',              -- Retiro de fondos (exchange → banco o wallet → wallet)
  'BRIDGE_IN',           -- Entrada de tokens vía bridge cross-chain
  'BRIDGE_OUT',          -- Salida de tokens vía bridge cross-chain

  -- Operaciones DeFi
  'REWARD_DEFI',         -- Recompensa de protocolo DeFi (farming, staking)

  -- Transferencias internas entre portfolios propios
  'TRANSFERENCIA_IN',    -- Entrada de activos desde otro portfolio interno
  'TRANSFERENCIA_OUT',   -- Salida de activos hacia otro portfolio interno

  -- Fees y ajustes
  'FEE_CADENA',          -- Fee de gas consumido (reduce cantidad de cripto)
  'FEE_EXCHANGE',        -- Comisión cobrada por exchange (registrada como info)
  'COMISION_ALYCE',      -- Comisión cobrada por la ALyC al admin

  -- Correcciones contables (uso excepcional, requiere justificación)
  'AJUSTE_PRECIO'        -- Ajuste de precio histórico por error de carga
);

-- -----------------------------------------------------------------------------
-- commission_type: Modelos de cobro de comisión al cliente
-- -----------------------------------------------------------------------------
CREATE TYPE public.commission_type AS ENUM (
  'PORCENTAJE_AUM',       -- % anual sobre patrimonio administrado (management fee)
  'PORCENTAJE_GANANCIA',  -- % sobre ganancia del período (performance fee / HWM)
  'FEE_FIJO_MENSUAL',     -- Monto fijo mensual en ARS o USD
  'FEE_POR_OPERACION'     -- Monto fijo por cada operación ejecutada
);

-- -----------------------------------------------------------------------------
-- commission_status: Estado del ciclo de vida de una comisión devengada
-- -----------------------------------------------------------------------------
CREATE TYPE public.commission_status AS ENUM (
  'DEVENGADA',  -- Calculada y pendiente de cobro
  'COBRADA',    -- Efectivamente percibida
  'ANULADA'     -- Anulada por corrección o acuerdo
);
