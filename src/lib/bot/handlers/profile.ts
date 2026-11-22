import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import { profileMessage, notRegisteredMessage } from "../ui"
import { profileKeyboard, phoneRequestKeyboard } from "@/lib/bot/keyboard"

async function buildProfileText(ctx: Parameters<typeof findBotUser>[0]) {
  const user = await findBotUser(ctx)
  if (!user) return null

  const count = await prisma.ticket.count({ where: { userId: user.id } })

  return profileMessage({
    name: user.name,
    phoneNumber: user.phoneNumber,
    telegramId: user.telegramId,
    totalTickets: count,
    createdAt: user.createdAt,
  })
}

bot.command("profile", async (ctx) => {
  const text = await buildProfileText(ctx)
  if (!text) {
    await ctx.reply(notRegisteredMessage(), {
      reply_markup: phoneRequestKeyboard(),
    })
    return
  }
  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: profileKeyboard(),
  })
})

bot.callbackQuery("profile", async (ctx) => {
  await ctx.answerCallbackQuery()
  const text = await buildProfileText(ctx)
  if (!text) {
    await ctx.editMessageText(notRegisteredMessage())
    return
  }
  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: profileKeyboard(),
  })
})