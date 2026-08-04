import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { Database } from '@/types/database.types'

export const dynamic = 'force-dynamic'

const ACCOUNTS = {
  ARS: '5ba5dcd2-20b6-46d2-a9ec-3fe914bcaac6',
  USD: 'c85fc3a7-641c-4ad0-a007-45acdda94735',
} as const

const CATEGORIES: Record<string, { id: string; label: string }> = {
  alimentacion:    { id: '3e711d99-15df-46a0-822d-025f245e1fa4', label: 'Alimentación' },
  educacion:       { id: '0d26dfe1-94e0-47cb-9c74-728eb1e59628', label: 'Educación' },
  entretenimiento: { id: '3542d8d0-e75c-4d88-ba1b-a6f7feb46900', label: 'Entretenimiento' },
  otros:           { id: 'fb7b9139-3238-42db-bebb-8c65dec1c67a', label: 'Otros' },
  ropa:            { id: '0834fc87-730a-46ba-bfd0-169cf052933e', label: 'Ropa' },
  salud:           { id: '0cfb9b92-dff4-490a-9b2d-90982b9c150f', label: 'Salud' },
  servicios:       { id: 'f95af623-f2ed-4fee-9df9-6ab4ca492bf3', label: 'Servicios' },
  transporte:      { id: '9d66c452-0280-4ce6-8ae6-bf3e23f4f3f0', label: 'Transporte' },
  viajes:          { id: '01aa0e46-0a4e-4c6d-9418-16b602403328', label: 'Viajes' },
  alquiler:        { id: 'bbebcd82-eb77-4e92-b427-3e68831ffa15', label: 'Alquiler cobrado' },
  dividendos:      { id: '806e10c8-aed7-4bda-856c-d588e88a9fed', label: 'Dividendos' },
  honorarios:      { id: '8226f82d-992e-497d-b949-72ffabf6b3a4', label: 'Honorarios' },
  sueldo:          { id: '029210ad-f806-49ac-a2d2-ff4e17ebe85c', label: 'Sueldo' },
}

const SYSTEM_PROMPT = `Sos un asistente que parsea mensajes de gastos e ingresos en español rioplatense.
Extraé la información y devolvé SOLO un JSON con este formato exacto:
{"type":"egreso"|"ingreso","amount":<número>,"currency":"ARS"|"USD","description":"<texto breve>","category":"<clave>"}

Claves de categoría válidas:
- egreso: alimentacion, educacion, entretenimiento, otros, ropa, salud, servicios, transporte, viajes
- ingreso: alquiler, dividendos, honorarios, sueldo

Reglas:
- Sin moneda explícita → ARS.
- "gasté/pagué/compré/comida/taxi/etc." → egreso. "cobré/recibí/sueldo/facturé" → ingreso.
- Si no podés parsear el mensaje → {"error":"no_parse"}
- Devolvé SOLO el JSON, sin texto extra ni bloques de código.`

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text }),
  })
}

function fmtAmount(amount: number, currency: string): string {
  const formatted = amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return currency === 'USD' ? `USD ${formatted}` : `$${formatted}`
}

function fmtDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response('ok', { status: 200 })
  }

  const update = body as {
    message?: { chat?: { id: number }; text?: string }
  }

  const chatId = update.message?.chat?.id
  const text   = update.message?.text

  if (!chatId || !text) {
    return new Response('ok', { status: 200 })
  }

  try {
    const claude   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await claude.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 500,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: text }],
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('unexpected content type')

    let parsed: {
      type?:        string
      amount?:      number
      currency?:    string
      description?: string
      category?:    string
      error?:       string
    }

    try {
      parsed = JSON.parse(block.text.trim())
    } catch {
      await sendTelegramMessage(chatId, "❌ No entendí. Ejemplo: 'gasté $5000 en supermercado'")
      return new Response('ok', { status: 200 })
    }

    if (parsed.error || !parsed.type || !parsed.amount || !parsed.category) {
      await sendTelegramMessage(chatId, "❌ No entendí. Ejemplo: 'gasté $5000 en supermercado'")
      return new Response('ok', { status: 200 })
    }

    const currency  = (parsed.currency ?? 'ARS') as keyof typeof ACCOUNTS
    const accountId = ACCOUNTS[currency] ?? ACCOUNTS.ARS
    const category  = CATEGORIES[parsed.category]

    if (!category) {
      await sendTelegramMessage(chatId, "❌ No entendí. Ejemplo: 'gasté $5000 en supermercado'")
      return new Response('ok', { status: 200 })
    }

    const now  = new Date()
    const date = now.toISOString().slice(0, 10)

    const supabase         = getServiceClient()
    const { error: dbErr } = await supabase.from('personal_transactions').insert({
      account_id:  accountId,
      category_id: category.id,
      type:        parsed.type,
      amount:      parsed.amount,
      currency,
      description: parsed.description ?? text,
      date,
      created_by:  'telegram',
    })

    if (dbErr) {
      console.error('[telegram/webhook] db error:', dbErr)
      await sendTelegramMessage(chatId, '❌ Error al guardar. Intentá de nuevo.')
      return new Response('ok', { status: 200 })
    }

    const emoji     = parsed.type === 'egreso' ? '💸' : '💰'
    const typeLabel = parsed.type === 'egreso' ? 'Egreso' : 'Ingreso'
    const reply     = [
      '✅ Registrado',
      `${emoji} ${typeLabel}: ${fmtAmount(parsed.amount, currency)}`,
      `📂 ${parsed.description ?? text} → ${category.label}`,
      `📅 ${fmtDate(now)}`,
    ].join('\n')

    await sendTelegramMessage(chatId, reply)
  } catch (e) {
    console.error('[telegram/webhook] error:', e)
    await sendTelegramMessage(chatId, "❌ No entendí. Ejemplo: 'gasté $5000 en supermercado'")
  }

  return new Response('ok', { status: 200 })
}
