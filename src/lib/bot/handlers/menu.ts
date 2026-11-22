import type { Context } from "grammy"

import { bot } from "../instance"
import { findBotUser } from "../user"
import { mainMenuMessage, notRegisteredMessage } from "../ui"
import { mainMenuKeyboard, phoneRequestKeyboard } from "@/lib/bot/keyboard"

async function showMenu(ctx: Context) {
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.reply(notRegisteredMessage(), {
      reply_markup: phoneRequestKeyboard(),
    })
    return
  }
  await ctx.reply(mainMenuMessage(user.name), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  })
}

bot.command("menu", showMenu)

bot.callbackQuery("menu", async (ctx) => {
  await ctx.answerCallbackQuery()
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.editMessageText(notRegisteredMessage())
    return
  }
  await ctx.editMessageText(mainMenuMessage(user.name), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  })
})