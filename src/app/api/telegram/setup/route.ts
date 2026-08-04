export const dynamic = 'force-dynamic'

const WEBHOOK_URL = 'https://admin-inv-app.vercel.app/api/telegram/webhook'

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN!

  const res  = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: WEBHOOK_URL }),
  })

  const data = await res.json()
  return Response.json(data)
}
