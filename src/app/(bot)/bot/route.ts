import type { Update } from "grammy/types"
import { bot } from "@/lib/bot/bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SECRET = process.env.BOT_WEBHOOK_SECRET
if (!SECRET) {
  console.warn(
    "[bot] BOT_WEBHOOK_SECRET is not set — webhook will accept unsigned requests.",
  )
}

export async function POST(req: Request): Promise<Response> {
  // Verify Telegram secret token when configured.
  if (SECRET) {
    const provided = req.headers.get("x-telegram-bot-api-secret-token")
    if (provided !== SECRET) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  let update: Update
  try {
    update = (await req.json()) as Update
  } catch {
    return new Response("Bad Request", { status: 400 })
  }

  try {
    await bot.init()          // idempotent — getMe is cached after first call
    await bot.handleUpdate(update)
  } catch (err) {
    // Log and return 200: a 500 would trigger Telegram retries, which is
    // worse than losing a single update.
    console.error("[bot] update handling error", err)
  }

  return new Response(null, { status: 200 })
}

export async function GET(): Promise<Response> {
  return new Response("Telegram webhook endpoint", { status: 200 })
}