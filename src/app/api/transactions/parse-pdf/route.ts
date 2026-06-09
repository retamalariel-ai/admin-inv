import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `Sos un asistente de contabilidad financiera para un ALyC argentino.
Se te provee un boleto de transacción en PDF. Extraé la información y respondé EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, sin bloques de código markdown.

Campos a extraer:
- custodian_name: nombre del ALyC/broker (string)
- transaction_type: "COMPRA" | "VENTA" | "SUSCRIPCION_FCI" | "RESCATE_FCI" | "RENTA" | "DIVIDENDO" | "AMORTIZACION" | "DEPOSITO" | "RETIRO" | null
- trade_date: fecha de concertación en formato YYYY-MM-DD (string | null)
- settlement_date: fecha de liquidación en formato YYYY-MM-DD (string | null)
- ticker: símbolo del activo (string | null). Ejemplos: "AL30", "GD30", "CEDEAR YPF", "MERVAL".
- asset_name: nombre completo del activo (string | null)
- asset_type_hint: "BONO_SOBERANO" | "BONO_SUBSOBERANO" | "ON" | "LETES" | "LECAP" | "ACCION" | "FCI" | "CEDEAR" | null
- quantity: cantidad (number | null). Para bonos es el VN nominal.
- price_per_unit: precio por unidad o VN 100 (number | null)
- gross_amount: monto bruto = cantidad × precio (number | null)
- alyce_commission: comisión del ALyC en pesos (number, default 0)
- other_fees: otros aranceles/derechos de mercado en pesos (number, default 0)
- net_amount: monto neto a liquidar (number | null)
- currency: "ARS" | "USD_MEP" | "USD_CCL" | "USD_CABLE" | "USD_OFICIAL" (string, default "ARS")
- comitente: número de comitente del cliente (string | null)
- operation_number: número de operación/boleto (string | null)
- notes: observaciones adicionales relevantes del boleto (string | null)

IMPORTANTE para identificar el ticker correcto:
- Buscá el código de especie BYMA en el boleto
- Los bonos soberanos argentinos usan estos tickers:
  AL29, AL30, AL35, AL41 = Bonares (ley argentina)
  GD29, GD30, GD35, GD38, GD41, GD46 = Globales (ley Nueva York)
  AO26 = Bonar 2026
- Si ves "STEP UP 2038" → ticker = GD38
- Si ves "STEP UP 2030" → ticker = GD30
- Si ves "STEP UP 2035" → ticker = GD35
- Si ves "STEP UP 2041" → ticker = GD41
- Si ves "STEP UP 2046" → ticker = GD46
- Si ves "BONAR 2030" o "AL 2030" → ticker = AL30
- Si ves "BONAR 2035" → ticker = AL35
- El número de especie BYMA (por ejemplo "5923") es un código interno de mercado — NUNCA lo uses como ticker
- Si el boleto tiene un número de especie y el nombre del instrumento, usá el nombre para inferir el ticker con la lista anterior
- Para CEDEARs: el ticker suele ser el símbolo de la empresa seguido de "D" (ej: AAPLD, GGALD, MSFTD)
- Para acciones locales: usá el ticker de BYMA (ej: GGAL, YPFD, TXAR)

Reglas:
- Si un campo no aparece en el documento, usá null (o 0 para fees).
- Para precios de bonos en Argentina, el price_per_unit normalmente es el precio cada VN 100.
- Si ves "Contado Inmediato" o "CI", la moneda probablemente es ARS. Si ves "MEP" o "T+1" con doble punta, puede ser USD_MEP.
- No inventes datos. Solo extraé lo que está explícitamente en el documento.

Respondé SOLO con el JSON, sin explicaciones.`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('pdf')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún PDF' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })
    }

    // In-memory conversion — never touches disk
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Claude no devolvió texto' }, { status: 500 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text.trim())
    } catch {
      return NextResponse.json(
        { error: 'No se pudo parsear la respuesta de Claude', raw: textBlock.text },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: parsed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
