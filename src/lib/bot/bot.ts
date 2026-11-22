import "server-only"
import { Bot } from "grammy"

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error("Missing BOT_TOKEN environment variable")
}

/**
 * Single shared grammY Bot instance.
 *
 * `new Bot()` does not connect — the webhook handler at `src/app/(bot)/bot/route.ts`
 * is expected to call `bot.handleUpdate(request.json())` (or `bot.start()` in dev).
 * Importing this from a server action is safe.
 */
export const bot = new Bot(token)