import { getPPIToken, getPPIQuote, assetTypeToPPI } from '@/lib/ppi/client'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get('ticker')

  try {
    const token = await getPPIToken()

    if (!ticker) {
      return Response.json({
        success:      true,
        tokenPreview: token.substring(0, 20) + '...',
      })
    }

    // Intentar como ACCIONES primero, luego BONOS si falla
    let quote
    let usedType: string
    try {
      quote    = await getPPIQuote(ticker, 'ACCIONES')
      usedType = 'ACCIONES'
    } catch {
      quote    = await getPPIQuote(ticker, 'BONOS')
      usedType = 'BONOS'
    }

    return Response.json({ success: true, ticker, type: usedType, quote })
  } catch (e) {
    return Response.json(
      { success: false, error: String(e) },
      { status: 500 },
    )
  }
}
