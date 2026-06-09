import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export const revalidate = 300 // 5 min cache

export async function GET() {
  // Service role para leer fx_rates sin sesión de usuario (datos públicos de mercado)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('fx_rates')
    .select('rate_mep, rate_ccl, rate_oficial, rate_blue, rate_date, rate_time')
    .order('rate_date', { ascending: false })
    .order('rate_time', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { mep: null, ccl: null, oficial: null, blue: null, date: null },
      { status: 200 },
    )
  }

  return NextResponse.json({
    mep:     data.rate_mep,
    ccl:     data.rate_ccl,
    oficial: data.rate_oficial,
    blue:    data.rate_blue,
    date:    data.rate_time
      ? `${data.rate_date}T${data.rate_time}`
      : data.rate_date,
  })
}
