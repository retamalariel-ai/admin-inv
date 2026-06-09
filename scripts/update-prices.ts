/**
 * Script de actualización manual de precios
 *
 * Uso:
 *   npx tsx scripts/update-prices.ts
 *   npx tsx scripts/update-prices.ts --base http://localhost:3001
 *
 * Requiere que el dev server esté corriendo (npm run dev).
 */

const BASE_URL = (() => {
  const flag = process.argv.indexOf('--base')
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1]
  return process.env.BASE_URL ?? 'http://localhost:3000'
})()

interface StepResult {
  ok:   boolean
  data: unknown
  ms:   number
}

async function post(path: string): Promise<StepResult> {
  const start = Date.now()
  try {
    const res  = await fetch(`${BASE_URL}${path}`, { method: 'POST' })
    const data = await res.json()
    return { ok: res.ok, data, ms: Date.now() - start }
  } catch (e) {
    return { ok: false, data: { error: String(e) }, ms: Date.now() - start }
  }
}

function label(ok: boolean) {
  return ok ? '✓' : '✗'
}

async function main() {
  console.log(`\n🔄  Actualizando precios — ${new Date().toLocaleString('es-AR')}`)
  console.log(`    Base URL: ${BASE_URL}\n`)

  // 1. FX rates
  process.stdout.write('  [1/3] FX rates (MEP/CCL/Oficial/Blue)... ')
  const fx = await post('/api/fx-rates/update')
  console.log(`${label(fx.ok)} ${fx.ms}ms`)
  if (fx.ok) {
    const d = fx.data as Record<string, unknown>
    console.log(`         source:  ${d.source}`)
    console.log(`         MEP:     $${Number(d.mep).toFixed(2)}`)
    console.log(`         CCL:     $${Number(d.ccl).toFixed(2)}`)
    console.log(`         Oficial: $${Number(d.oficial).toFixed(2)}`)
    console.log(`         Blue:    $${Number(d.blue).toFixed(2)}`)
  } else {
    console.log(`         Error: ${JSON.stringify(fx.data)}`)
  }

  // 2. TradFi
  process.stdout.write('\n  [2/3] TradFi prices (acciones/bonos/CEDEARs)... ')
  const tradfi = await post('/api/prices/tradfi')
  console.log(`${label(tradfi.ok)} ${tradfi.ms}ms`)
  if (tradfi.ok) {
    const d = tradfi.data as Record<string, unknown>
    console.log(`         assets updated: ${d.assetsUpdated}`)
    console.log(`         MEP from bonds: $${Number(d.mep).toFixed(2)}`)
    if ((d.tickersNotFound as string[])?.length) {
      console.log(`         not found: ${(d.tickersNotFound as string[]).join(', ')}`)
    }
  } else {
    console.log(`         Error: ${JSON.stringify(tradfi.data)}`)
  }

  // 3. Crypto
  process.stdout.write('\n  [3/3] Crypto prices (CoinGecko)... ')
  const crypto = await post('/api/prices/crypto')
  console.log(`${label(crypto.ok)} ${crypto.ms}ms`)
  if (crypto.ok) {
    const d = crypto.data as Record<string, unknown>
    console.log(`         assets updated: ${d.assetsUpdated ?? d.updated ?? d.count ?? '?'}`)
  } else {
    console.log(`         Error: ${JSON.stringify(crypto.data)}`)
  }

  const allOk = fx.ok && tradfi.ok && crypto.ok
  console.log(`\n${allOk ? '✅' : '⚠️ '}  Completado en ${fx.ms + tradfi.ms + crypto.ms}ms\n`)

  process.exit(allOk ? 0 : 1)
}

main().catch(e => {
  console.error('\n❌  Error fatal:', e)
  process.exit(1)
})
