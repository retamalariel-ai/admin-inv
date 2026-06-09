import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFXTypeForAsset, getFXForDate } from '@/lib/utils/fxLookup'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date      = searchParams.get('date')
  const assetType = searchParams.get('assetType')
  const ticker    = searchParams.get('ticker')

  if (!date || !assetType || !ticker) {
    return NextResponse.json(
      { error: 'date, assetType y ticker son requeridos' },
      { status: 400 },
    )
  }

  const supabase  = await createClient()
  const fxType    = getFXTypeForAsset(assetType, ticker)
  const otherType = fxType === 'MEP' ? 'CCL' : 'MEP'

  const [fx, otherFx] = await Promise.all([
    getFXForDate(date, fxType, supabase),
    getFXForDate(date, otherType, supabase),
  ])

  const warning = fx.rate == null
    ? `No hay tipo de cambio registrado para esta fecha. Ingresalo manualmente.`
    : !fx.exact && fx.rate_date
    ? `No hay FX para ${date}. Usando el del ${fx.rate_date}.`
    : null

  return NextResponse.json({
    date,
    ticker,
    assetType,
    recommended: {
      type:      fxType,
      rate:      fx.rate,
      rate_date: fx.rate_date,
      source:    fx.source,
      exact:     fx.exact,
      warning,
    },
    reference: {
      type:      otherType,
      rate:      otherFx.rate,
      rate_date: otherFx.rate_date,
    },
  })
}
