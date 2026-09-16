import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ── IDs fijos de assets y cuentas ─────────────────────────────────────────────
const NEXO_ASSET_ID       = 'd9150768-4186-4d12-b7db-6cdb9ea46a8b'
const CUENTA_COMITENTE_ID = '5d993bf0-9fc6-4c6a-9344-f38b84e9ffc4'
const EFECTIVO_USD_ID     = 'c85fc3a7-641c-4ad0-a007-45acdda94735'

type TipoOperacion =
  | 'RESCATE_A_CUENTA'
  | 'GASTO_TD_COCOS'
  | 'GASTO_NEXO_CARD'
  | 'INGRESO_COMITENTE'

interface RequestBody {
  tipo:            TipoOperacion
  fecha:           string
  monto:           number
  moneda:          string
  descripcion:     string
  // inversión
  asset_id?:       string
  portfolio_id?:   string
  quantity?:       number
  price_per_unit?: number
  fx_rate_mep?:    number
  // personal
  cuenta_id?:      string
  categoria_id?:   string
  // Nexo Card
  nexo_quantity?:  number
  nexo_price_usd?: number
}

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: Request) {
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const { tipo, fecha, monto, moneda, descripcion } = body

  if (!tipo || !fecha || monto == null || !moneda) {
    return NextResponse.json(
      { success: false, error: 'Campos requeridos: tipo, fecha, monto, moneda' },
      { status: 400 },
    )
  }

  const db = svc()

  try {
    switch (tipo) {
      case 'RESCATE_A_CUENTA':
        return await rescateACuenta(db, body)
      case 'GASTO_TD_COCOS':
        return await gastoTdCocos(db, body)
      case 'GASTO_NEXO_CARD':
        return await gastoNexoCard(db, body)
      case 'INGRESO_COMITENTE':
        return await ingresoComitente(db, body)
      default:
        return NextResponse.json(
          { success: false, error: `Tipo desconocido: ${tipo}` },
          { status: 400 },
        )
    }
  } catch (err) {
    console.error('[cruzadas] error inesperado:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    )
  }
}

// ── RESCATE_A_CUENTA ──────────────────────────────────────────────────────────
// Rescate FCI o retiro crypto → cuenta personal
async function rescateACuenta(db: ReturnType<typeof svc>, body: RequestBody) {
  const { fecha, monto, moneda, descripcion, asset_id, portfolio_id,
          quantity, price_per_unit, fx_rate_mep, cuenta_id, categoria_id } = body

  if (!asset_id || !portfolio_id || !quantity || !price_per_unit) {
    return NextResponse.json(
      { success: false, error: 'RESCATE_A_CUENTA requiere: asset_id, portfolio_id, quantity, price_per_unit' },
      { status: 400 },
    )
  }

  // Determinar tipo de transacción inversora según el activo
  const { data: asset } = await db.from('assets').select('asset_type').eq('id', asset_id).single()
  const txType = asset?.asset_type?.startsWith('FCI') ? 'RESCATE_FCI' : 'RETIRO'

  const grossAmount = quantity * price_per_unit

  // 1. Insertar en transactions
  const { data: invTx, error: invErr } = await db.from('transactions').insert({
    portfolio_id,
    asset_id,
    transaction_type:     txType,
    trade_date:           fecha,
    quantity,
    price_per_unit,
    gross_amount:         grossAmount,
    net_amount:           monto,
    currency:             moneda,
    fx_rate_mep:          fx_rate_mep ?? null,
    notes:                descripcion,
    residual_factor_at_trade: 1,
  }).select('id').single()

  if (invErr) {
    console.error('[cruzadas/RESCATE_A_CUENTA] inv insert error:', invErr)
    return NextResponse.json({ success: false, error: invErr.message }, { status: 500 })
  }

  // 2. Insertar en personal_transactions
  const { data: persTx, error: persErr } = await db.from('personal_transactions').insert({
    account_id:  cuenta_id ?? null,
    category_id: categoria_id ?? null,
    type:        'INGRESO',
    amount:      monto,
    currency:    moneda,
    fx_rate:     fx_rate_mep ?? null,
    amount_ars:  fx_rate_mep ? monto * fx_rate_mep : null,
    description: descripcion,
    date:        fecha,
  }).select('id').single()

  if (persErr) {
    // Rollback manual: anular la transacción de inversión recién creada
    console.error('[cruzadas/RESCATE_A_CUENTA] pers insert error:', persErr)
    await db.from('transactions').update({ is_cancelled: true }).eq('id', invTx!.id)
    return NextResponse.json(
      { success: false, error: persErr.message, rollback: 'inv_cancelled' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success:                 true,
    tipo:                    body.tipo,
    transactions_id:         invTx!.id,
    personal_transaction_id: persTx!.id,
  })
}

// ── GASTO_TD_COCOS ────────────────────────────────────────────────────────────
// Pago con TD Cocos → rescata del FCI y registra egreso en cuenta comitente
async function gastoTdCocos(db: ReturnType<typeof svc>, body: RequestBody) {
  const { fecha, monto, moneda, descripcion, asset_id, portfolio_id,
          quantity, price_per_unit, fx_rate_mep, categoria_id } = body

  if (!asset_id || !portfolio_id || !quantity || !price_per_unit) {
    return NextResponse.json(
      { success: false, error: 'GASTO_TD_COCOS requiere: asset_id, portfolio_id, quantity, price_per_unit' },
      { status: 400 },
    )
  }

  const grossAmount = quantity * price_per_unit

  // 1. Rescate FCI
  const { data: invTx, error: invErr } = await db.from('transactions').insert({
    portfolio_id,
    asset_id,
    transaction_type:     'RESCATE_FCI',
    trade_date:           fecha,
    quantity,
    price_per_unit,
    gross_amount:         grossAmount,
    net_amount:           monto,
    currency:             moneda,
    fx_rate_mep:          fx_rate_mep ?? null,
    notes:                `TD Cocos: ${descripcion}`,
    residual_factor_at_trade: 1,
  }).select('id').single()

  if (invErr) {
    console.error('[cruzadas/GASTO_TD_COCOS] inv insert error:', invErr)
    return NextResponse.json({ success: false, error: invErr.message }, { status: 500 })
  }

  // 2. Egreso en cuenta comitente
  const { data: persTx, error: persErr } = await db.from('personal_transactions').insert({
    account_id:  CUENTA_COMITENTE_ID,
    category_id: categoria_id ?? null,
    type:        'EGRESO',
    amount:      monto,
    currency:    moneda,
    fx_rate:     fx_rate_mep ?? null,
    amount_ars:  fx_rate_mep ? monto * fx_rate_mep : (moneda === 'ARS' ? monto : null),
    description: descripcion,
    date:        fecha,
  }).select('id').single()

  if (persErr) {
    console.error('[cruzadas/GASTO_TD_COCOS] pers insert error:', persErr)
    await db.from('transactions').update({ is_cancelled: true }).eq('id', invTx!.id)
    return NextResponse.json(
      { success: false, error: persErr.message, rollback: 'inv_cancelled' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success:                 true,
    tipo:                    body.tipo,
    transactions_id:         invTx!.id,
    personal_transaction_id: persTx!.id,
  })
}

// ── GASTO_NEXO_CARD ───────────────────────────────────────────────────────────
// Pago con Nexo Card → retiro NEXO + egreso en efectivo USD
async function gastoNexoCard(db: ReturnType<typeof svc>, body: RequestBody) {
  const { fecha, monto, moneda, descripcion,
          portfolio_id, nexo_quantity, nexo_price_usd, categoria_id } = body

  if (!portfolio_id || !nexo_quantity || !nexo_price_usd) {
    return NextResponse.json(
      { success: false, error: 'GASTO_NEXO_CARD requiere: portfolio_id, nexo_quantity, nexo_price_usd' },
      { status: 400 },
    )
  }

  const grossAmount = nexo_quantity * nexo_price_usd

  // 1. Retiro NEXO
  const { data: invTx, error: invErr } = await db.from('transactions').insert({
    portfolio_id,
    asset_id:             NEXO_ASSET_ID,
    transaction_type:     'RETIRO',
    trade_date:           fecha,
    quantity:             nexo_quantity,
    price_per_unit:       nexo_price_usd,
    gross_amount:         grossAmount,
    net_amount:           monto,
    currency:             'USD_MEP',
    crypto_price_usd:     nexo_price_usd,
    notes:                `Nexo Card: ${descripcion}`,
    residual_factor_at_trade: 1,
  }).select('id').single()

  if (invErr) {
    console.error('[cruzadas/GASTO_NEXO_CARD] inv insert error:', invErr)
    return NextResponse.json({ success: false, error: invErr.message }, { status: 500 })
  }

  // 2. Egreso en cuenta origen (efectivo USD por defecto, o USDT wallet)
  const { data: persTx, error: persErr } = await db.from('personal_transactions').insert({
    account_id:  body.cuenta_id ?? EFECTIVO_USD_ID,
    category_id: categoria_id ?? null,
    type:        'EGRESO',
    amount:      monto,
    currency:    moneda,
    description: descripcion,
    date:        fecha,
  }).select('id').single()

  if (persErr) {
    console.error('[cruzadas/GASTO_NEXO_CARD] pers insert error:', persErr)
    await db.from('transactions').update({ is_cancelled: true }).eq('id', invTx!.id)
    return NextResponse.json(
      { success: false, error: persErr.message, rollback: 'inv_cancelled' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success:                 true,
    tipo:                    body.tipo,
    transactions_id:         invTx!.id,
    personal_transaction_id: persTx!.id,
  })
}

// ── INGRESO_COMITENTE ─────────────────────────────────────────────────────────
// Cobro de honorarios/factura → registra ingreso en cuenta comitente
// Solo genera un registro personal (no hay movimiento de inversión)
async function ingresoComitente(db: ReturnType<typeof svc>, body: RequestBody) {
  const { fecha, monto, moneda, descripcion, fx_rate_mep, categoria_id } = body

  const { data: persTx, error: persErr } = await db.from('personal_transactions').insert({
    account_id:  body.cuenta_id ?? CUENTA_COMITENTE_ID,
    category_id: categoria_id ?? null,
    type:        'INGRESO',
    amount:      monto,
    currency:    moneda,
    fx_rate:     fx_rate_mep ?? null,
    amount_ars:  fx_rate_mep ? monto * fx_rate_mep : (moneda === 'ARS' ? monto : null),
    description: descripcion,
    date:        fecha,
  }).select('id').single()

  if (persErr) {
    console.error('[cruzadas/INGRESO_COMITENTE] pers insert error:', persErr)
    return NextResponse.json({ success: false, error: persErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success:                 true,
    tipo:                    body.tipo,
    transactions_id:         null,
    personal_transaction_id: persTx!.id,
  })
}
