'use client'

import { useQuery } from '@tanstack/react-query'
import Decimal from 'decimal.js'

export interface FXRatesData {
  mep:     Decimal
  ccl:     Decimal
  oficial: Decimal
  blue:    Decimal | null
  date:    Date | null
}

export function useFXRates() {
  return useQuery<FXRatesData>({
    queryKey: ['fx-rates'],
    queryFn: async () => {
      const res  = await fetch('/api/fx-rates')
      const data = await res.json() as {
        mep:     number | null
        ccl:     number | null
        oficial: number | null
        blue:    number | null
        date:    string | null
      }
      return {
        mep:     new Decimal(data.mep     ?? 0),
        ccl:     new Decimal(data.ccl     ?? 0),
        oficial: new Decimal(data.oficial ?? 0),
        blue:    data.blue != null ? new Decimal(data.blue) : null,
        date:    data.date ? new Date(data.date) : null,
      }
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime:       4 * 60 * 1000,
  })
}
