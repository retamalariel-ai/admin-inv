import { createClient } from '@supabase/supabase-js'
import { getCAFCIQuotes } from '@/lib/cafci/client'
import type { Database } from '@/types/database.types'

type Currency = Database['public']['Enums']['currency']

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST() {
  const supabase = getServiceClient()

  // Obtener FCIs activos con fci_cafci_id registrado
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, ticker, currency, fci_cafci_id')
    .eq('data_source', 'CAFCI_API')
    .eq('is_active', true)
    .not('fci_cafci_id', 'is', null)

  if (error || !assets?.length) {
    return Response.json(
      { success: false, error: error?.message ?? 'No FCI assets with fci_cafci_id' },
      { status: 404 },
    )
  }

  // Descargar VCPs desde CAFCI
  let quotes: Map<number, { vcp: number; vcpAnterior: number; fecha: string; moneda: string }>
  try {
    quotes = await getCAFCIQuotes()
  } catch (e) {
    return Response.json(
      { success: false, error: 'CAFCI download failed', detail: String(e) },
      { status: 503 },
    )
  }

  const now       = new Date()
  const quoteTime = now.toTimeString().slice(0, 8)

  const inserts: Database['public']['Tables']['price_quotes']['Insert'][] = []
  const found:   string[] = []
  const notFound: string[] = []

  for (const asset of assets) {
    const q = quotes.get(asset.fci_cafci_id!)
    if (!q || q.vcp <= 0) { notFound.push(asset.ticker); continue }

    // Convertir fecha CAFCI DD/MM/YY → YYYY-MM-DD
    const [d, mo, y] = q.fecha.split('/')
    const quoteDate = y
      ? `20${y.padStart(2, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      : now.toISOString().slice(0, 10)

    inserts.push({
      asset_id:   asset.id,
      quote_date: quoteDate,
      quote_time: quoteTime,
      price:      q.vcp,
      price_open: q.vcpAnterior > 0 ? q.vcpAnterior : null,
      currency:   asset.currency as Currency,
      source:     'CAFCI_API',
      is_closing: true,
    })
    found.push(asset.ticker)
  }

  if (inserts.length === 0) {
    return Response.json({ success: false, error: 'No quotes matched', notFound })
  }

  const { error: upsertErr } = await supabase
    .from('price_quotes')
    .upsert(inserts, {
      onConflict:      'asset_id,quote_date,source',
      ignoreDuplicates: false,
    })

  if (upsertErr) {
    return Response.json({ success: false, error: upsertErr.message }, { status: 500 })
  }

  return Response.json({
    success:       true,
    source:        'CAFCI_API',
    assetsUpdated: inserts.length,
    found,
    notFound,
    quotes: inserts.map(i => ({
      ticker: found[inserts.indexOf(i)],
      price:  i.price,
      date:   i.quote_date,
    })),
  })
}
