import "server-only"
import { Bot } from "grammy"

const token = process.env.BOT_TOKEN
if (!token) {
  throw new Error("Missing BOT_TOKEN environment variable")
}

/**
 * Single raw grammY instance. Handlers register in `bot.ts`;
 * `admin.ts` only needs `.api` for broadcasting.
 */
export const bot = new Bot(token)