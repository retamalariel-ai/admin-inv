export type FXType = 'MEP' | 'CCL'

export interface FXResult {
  rate:      number | null
  rate_date: string | null
  source:    string | null
  exact:     boolean
}

export function getFXTypeForAsset(assetType: string, ticker: string): FXType {
  if (
    ticker.endsWith('D') ||
    assetType === 'CEDEAR' ||
    (assetType === 'BONO_SUBSOBERANO' && ticker.startsWith('GD'))
  ) return 'CCL'
  if (ticker.startsWith('GD')) return 'CCL'
  return 'MEP'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFXForDate(date: string, fxType: FXType, supabase: any): Promise<FXResult> {
  const col = fxType === 'MEP' ? 'rate_mep' : 'rate_ccl'

  const { data } = await supabase
    .from('fx_rates')
    .select('rate_mep, rate_ccl, rate_date, source')
    .lte('rate_date', date)
    .not(col, 'is', null)
    .order('rate_date', { ascending: false })
    .order('rate_time', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  if (!data) return { rate: null, rate_date: null, source: null, exact: false }

  return {
    rate:      fxType === 'MEP' ? data.rate_mep : data.rate_ccl,
    rate_date: data.rate_date,
    source:    data.source,
    exact:     data.rate_date === date,
  }
}
