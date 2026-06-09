-- =============================================================================
-- SEED 002: Activos del ecosistema cripto
-- Tipo: datos iniciales (seed), NO es una migración de esquema
-- Descripción: Carga el catálogo de criptoactivos: spot, stablecoins,
--              posiciones Earn, staking DeFi, pools de liquidez,
--              lending DeFi y saldos de cash cripto.
-- Idempotente: ON CONFLICT (ticker) DO NOTHING en todos los INSERTs.
--              Los UPDATE usan WHERE underlying_asset_id IS NULL para no
--              sobreescribir si el link ya fue seteado.
-- Requisito previo: migraciones 001-008 aplicadas.
-- Schema destino: public
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- CRYPTO SPOT
-- Tenencia directa de criptomonedas en exchange o wallet.
-- Precio en USD por unidad, fuente CoinGecko.
-- DOT, AVAX, LINK y ARB usan CRYPTO_OTHER porque no están en el ENUM currency.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  coingecko_id, data_source, is_stablecoin
)
VALUES
  ('BTC',  'Bitcoin',   'CRYPTO_SPOT', 'BTC',          'bitcoin',   'bitcoin',       'COINGECKO', FALSE),
  ('ETH',  'Ethereum',  'CRYPTO_SPOT', 'ETH',          'ethereum',  'ethereum',      'COINGECKO', FALSE),
  ('SOL',  'Solana',    'CRYPTO_SPOT', 'SOL',          'solana',    'solana',        'COINGECKO', FALSE),
  ('MATIC','Polygon',   'CRYPTO_SPOT', 'MATIC',        'polygon',   'matic-network', 'COINGECKO', FALSE),
  ('BNB',  'BNB Chain', 'CRYPTO_SPOT', 'BNB',          'bsc',       'binancecoin',   'COINGECKO', FALSE),
  ('ADA',  'Cardano',   'CRYPTO_SPOT', 'ADA',          'cardano',   'cardano',       'COINGECKO', FALSE),
  ('DOT',  'Polkadot',  'CRYPTO_SPOT', 'CRYPTO_OTHER', 'polkadot',  'polkadot',      'COINGECKO', FALSE),
  ('AVAX', 'Avalanche', 'CRYPTO_SPOT', 'CRYPTO_OTHER', 'avalanche', 'avalanche-2',   'COINGECKO', FALSE),
  ('LINK', 'Chainlink', 'CRYPTO_SPOT', 'CRYPTO_OTHER', 'ethereum',  'chainlink',     'COINGECKO', FALSE),
  ('ARB',  'Arbitrum',  'CRYPTO_SPOT', 'CRYPTO_OTHER', 'arbitrum',  'arbitrum',      'COINGECKO', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- STABLECOINS
-- is_stablecoin = TRUE: recalculate_position() las trata 1:1 con USD.
-- USDT_BSC y USDC_SOL son el mismo activo económico en diferente red;
-- el ticker los distingue para trackear posiciones por red separadamente.
-- Comparten coingecko_id con su equivalente en Ethereum.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  coingecko_id, data_source, is_stablecoin
)
VALUES
  ('USDT',     'Tether USD',        'CRYPTO_STABLECOIN', 'USDT', 'ethereum', 'tether',   'COINGECKO', TRUE),
  ('USDC',     'USD Coin',          'CRYPTO_STABLECOIN', 'USDC', 'ethereum', 'usd-coin', 'COINGECKO', TRUE),
  ('DAI',      'Dai Stablecoin',    'CRYPTO_STABLECOIN', 'DAI',  'ethereum', 'dai',      'COINGECKO', TRUE),
  ('USDT_BSC', 'Tether USD — BSC',  'CRYPTO_STABLECOIN', 'USDT', 'bsc',      'tether',   'COINGECKO', TRUE),
  ('USDC_SOL', 'USD Coin — Solana', 'CRYPTO_STABLECOIN', 'USDC', 'solana',   'usd-coin', 'COINGECKO', TRUE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- CRYPTO EARN
-- Posiciones en productos de rendimiento centralizado (Binance Earn, Nexo, etc.).
-- El precio sigue al subyacente (mismo coingecko_id que el spot).
-- data_source = MANUAL: el precio se toma del spot subyacente, no de un feed propio.
-- underlying_asset_id se linkea con UPDATE después del INSERT.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  coingecko_id, data_source, is_stablecoin
)
VALUES
  ('BTC-EARN',  'Bitcoin — Binance Earn',   'CRYPTO_EARN', 'BTC',  'bitcoin',  'bitcoin',  'MANUAL', FALSE),
  ('ETH-EARN',  'Ethereum — Binance Earn',  'CRYPTO_EARN', 'ETH',  'ethereum', 'ethereum', 'MANUAL', FALSE),
  ('USDT-EARN', 'Tether — Nexo Earn',       'CRYPTO_EARN', 'USDT', 'ethereum', 'tether',   'MANUAL', FALSE),
  ('USDC-EARN', 'USD Coin — Binance Earn',  'CRYPTO_EARN', 'USDC', 'ethereum', 'usd-coin', 'MANUAL', FALSE),
  ('SOL-EARN',  'Solana — Earn',            'CRYPTO_EARN', 'SOL',  'solana',   'solana',   'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- Linkeo de underlying_asset_id para tokens Earn
UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'BTC')
WHERE ticker = 'BTC-EARN' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'ETH')
WHERE ticker = 'ETH-EARN' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'USDT')
WHERE ticker = 'USDT-EARN' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'USDC')
WHERE ticker = 'USDC-EARN' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'SOL')
WHERE ticker = 'SOL-EARN' AND underlying_asset_id IS NULL;

-- =============================================================================
-- DEFI — STAKING LÍQUIDO
-- Tokens derivados de protocolos de staking (Lido, Marinade, Coinbase).
-- Tienen precio propio en CoinGecko: acumulan el rendimiento del validador
-- en el ratio de conversión respecto al nativo (stETH ≠ 1 ETH exacto).
-- underlying_asset_id apunta al nativo depositado en el protocolo.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  coingecko_id, data_source, is_stablecoin
)
VALUES
  ('STETH', 'Lido Staked ETH',             'CRYPTO_DEFI_STAKE', 'ETH', 'ethereum', 'staked-ether',                'COINGECKO', FALSE),
  ('MSOL',  'Marinade Staked SOL',         'CRYPTO_DEFI_STAKE', 'SOL', 'solana',   'msol',                        'COINGECKO', FALSE),
  ('CBETH', 'Coinbase Wrapped Staked ETH', 'CRYPTO_DEFI_STAKE', 'ETH', 'ethereum', 'coinbase-wrapped-staked-eth', 'COINGECKO', FALSE)
ON CONFLICT (ticker) DO NOTHING;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'ETH')
WHERE ticker = 'STETH' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'SOL')
WHERE ticker = 'MSOL' AND underlying_asset_id IS NULL;

UPDATE public.assets
SET underlying_asset_id = (SELECT id FROM public.assets WHERE ticker = 'ETH')
WHERE ticker = 'CBETH' AND underlying_asset_id IS NULL;

-- =============================================================================
-- DEFI — POOLS DE LIQUIDEZ (LP)
-- Posiciones de provisión de liquidez en AMMs (Uniswap V3, Curve, Orca).
-- El valor de la posición LP no está en CoinGecko; se calcula off-chain
-- desde el contrato del protocolo y se carga vía MANUAL.
-- currency = CRYPTO_OTHER porque representan una canasta de dos tokens.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  data_source, is_stablecoin
)
VALUES
  ('ETH-USDC-UNI-V3', 'Uniswap V3 — ETH/USDC Pool', 'CRYPTO_DEFI_LP', 'CRYPTO_OTHER', 'ethereum', 'MANUAL', FALSE),
  ('WBTC-ETH-UNI-V3', 'Uniswap V3 — WBTC/ETH Pool', 'CRYPTO_DEFI_LP', 'CRYPTO_OTHER', 'ethereum', 'MANUAL', FALSE),
  ('USDC-USDT-CURVE',  'Curve — USDC/USDT Pool',     'CRYPTO_DEFI_LP', 'CRYPTO_OTHER', 'ethereum', 'MANUAL', FALSE),
  ('SOL-USDC-ORCA',    'Orca — SOL/USDC Pool',       'CRYPTO_DEFI_LP', 'CRYPTO_OTHER', 'solana',   'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- DEFI — LENDING
-- Posiciones acreedoras en protocolos de préstamo descentralizado (Aave, Compound).
-- El valor crece con los intereses acumulados (aToken en Aave, cToken en Compound).
-- El precio se actualiza manualmente desde el protocolo.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  data_source, is_stablecoin
)
VALUES
  ('AAVE-USDC', 'Aave V3 — USDC Supplied',    'CRYPTO_DEFI_LENDING', 'USDC', 'ethereum', 'MANUAL', FALSE),
  ('AAVE-ETH',  'Aave V3 — ETH Supplied',      'CRYPTO_DEFI_LENDING', 'ETH',  'ethereum', 'MANUAL', FALSE),
  ('COMP-USDC', 'Compound V3 — USDC Supplied', 'CRYPTO_DEFI_LENDING', 'USDC', 'ethereum', 'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;

-- =============================================================================
-- CASH CRIPTO
-- Saldos líquidos en exchanges y wallets, separados por red.
-- CASH_CRYPTO_STABLE: saldos en stablecoins, valuados qty * fx_mep en la vista
--   (mismo tratamiento que CASH_USD_MEP). is_stablecoin = TRUE.
-- CASH_CRYPTO_NATIVE: cripto nativa para gas/fees, valuada qty * price * fx_mep
--   en la vista (mismo tratamiento que CRYPTO_SPOT). is_stablecoin = FALSE.
-- =============================================================================
INSERT INTO public.assets (
  ticker, name, asset_type, currency, blockchain_network,
  data_source, is_stablecoin
)
VALUES
  ('CASH_USDT_ETH',  'Saldo USDT en Ethereum', 'CASH_CRYPTO_STABLE', 'USDT',  'ethereum', 'MANUAL', TRUE),
  ('CASH_USDC_ETH',  'Saldo USDC en Ethereum', 'CASH_CRYPTO_STABLE', 'USDC',  'ethereum', 'MANUAL', TRUE),
  ('CASH_USDT_BSC',  'Saldo USDT en BSC',       'CASH_CRYPTO_STABLE', 'USDT',  'bsc',      'MANUAL', TRUE),
  ('CASH_ETH_GAS',   'ETH para gas — Ethereum', 'CASH_CRYPTO_NATIVE', 'ETH',   'ethereum', 'MANUAL', FALSE),
  ('CASH_SOL_GAS',   'SOL para fees — Solana',  'CASH_CRYPTO_NATIVE', 'SOL',   'solana',   'MANUAL', FALSE),
  ('CASH_MATIC_GAS', 'MATIC para gas — Polygon','CASH_CRYPTO_NATIVE', 'MATIC', 'polygon',  'MANUAL', FALSE)
ON CONFLICT (ticker) DO NOTHING;
