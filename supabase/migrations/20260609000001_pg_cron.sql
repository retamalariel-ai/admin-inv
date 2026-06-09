-- =============================================================================
-- MIGRACIÓN 010: pg_cron — actualización automática de precios de mercado
-- Descripción: Configura un job que llama al endpoint /api/market/update-all
--              cada 5 minutos en horario de mercado BYMA.
--              Horario: 13:00-21:00 UTC = 10:00-18:00 ART, lunes a viernes.
-- Requisito previo:
--   1. Extensiones pg_cron y pg_net habilitadas en Supabase
--      (Dashboard → Database → Extensions → buscar "cron" y "http")
--   2. Variable app.cron_secret configurada (ver comentario abajo)
--   3. URL de Vercel conocida — reemplazar TU_APP_URL antes de ejecutar
-- Ejecución: manualmente en Supabase SQL Editor (no via supabase db push)
-- =============================================================================

-- ── Pre-requisito: guardar el CRON_SECRET como parámetro de configuración ──
-- Ejecutar una vez antes de crear el job, reemplazando el valor:
--
--   ALTER DATABASE postgres SET app.cron_secret = 'TU_CRON_SECRET_AQUI';
--
-- Esto persiste el secret en la configuración de la base de datos y lo hace
-- disponible via current_setting('app.cron_secret') dentro de los jobs.

-- ── Eliminar job previo si existe (idempotente) ───────────────────────────
SELECT cron.unschedule('update-market-prices')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'update-market-prices'
);

-- ── Crear job: cada 5 min, lunes-viernes, 13:00-21:00 UTC ─────────────────
SELECT cron.schedule(
  'update-market-prices',
  '*/5 13-21 * * 1-5',
  $$
  SELECT net.http_post(
    url     := 'https://TU_APP_URL.vercel.app/api/market/update-all',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', current_setting('app.cron_secret')
    ),
    body    := '{}'::jsonb
  )
  $$
);

-- ── Verificar que el job quedó registrado ─────────────────────────────────
SELECT jobid, jobname, schedule, command, active
FROM   cron.job
WHERE  jobname = 'update-market-prices';
