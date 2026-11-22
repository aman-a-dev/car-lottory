import { bot } from "../instance"
import { supportMessage } from "../ui"
import { supportKeyboard } from "@/lib/bot/keyboard"

bot.command("support", async (ctx) => {
  await ctx.reply(supportMessage(), {
    parse_mode: "HTML",
    reply_markup: supportKeyboard(),
  })
})

bot.callbackQuery("support", async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(supportMessage(), {
    parse_mode: "HTML",
    reply_markup: supportKeyboard(),
  })
})