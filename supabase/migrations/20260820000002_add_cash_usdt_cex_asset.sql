-- =============================================================================
-- Agrega CASH_USDT_CEX: saldo USDT en exchange centralizado (Binance, OKX, etc.)
--
-- Por qué CASH_CRYPTO_STABLE y no CRYPTO_STABLECOIN:
--   • CASH_CRYPTO_STABLE valúa directamente qty × fx_mep_today (1 USDT = 1 USD)
--   • No depende de feed de precio externo; ideal para saldos en CEX
--   • CRYPTO_STABLECOIN requeriría precio de CoinGecko y haría conversión extra
--
-- Uso recomendado:
--   • Proceder de venta de crypto en Binance que quedó como USDT en el exchange
--   • Honorarios cobrados en USDT y depositados en Binance
--   • Cualquier saldo USDT en exchange que no esté en wallet on-chain
-- =============================================================================

INSERT INTO public.assets (
  ticker,
  name,
  asset_type,
  currency,
  blockchain_network,
  data_source,
  is_active,
  is_stablecoin
)
VALUES (
  'CASH_USDT_CEX',
  'Saldo USDT en Exchange (CEX)',
  'CASH_CRYPTO_STABLE',
  'USDT',
  'cex',
  'MANUAL',
  TRUE,
  TRUE
)
ON CONFLICT (ticker) DO UPDATE
  SET
    name               = EXCLUDED.name,
    asset_type         = EXCLUDED.asset_type,
    currency           = EXCLUDED.currency,
    blockchain_network = EXCLUDED.blockchain_network,
    data_source        = EXCLUDED.data_source,
    is_active          = EXCLUDED.is_active,
    is_stablecoin      = EXCLUDED.is_stablecoin;
