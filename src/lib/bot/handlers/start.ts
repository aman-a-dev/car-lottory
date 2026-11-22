import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import {
  welcomeMessage,
  mainMenuMessage,
  registerCompleteMessage,
} from "../ui"
import { mainMenuKeyboard, phoneRequestKeyboard } from "@/lib/bot/keyboard"

bot.command("start", async (ctx) => {
  const existing = await findBotUser(ctx)
  if (existing) {
    await ctx.reply(mainMenuMessage(existing.name), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    })
    return
  }
  await ctx.reply(welcomeMessage(), {
    parse_mode: "HTML",
    reply_markup: phoneRequestKeyboard(),
  })
})

bot.on("message:contact", async (ctx) => {
  if (!ctx.from) return
  const contact = ctx.message.contact

  // Only the user's own Telegram contact is accepted.
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply(
      "⚠️ Please share your <b>own</b> phone number using the button below.",
      { parse_mode: "HTML", reply_markup: phoneRequestKeyboard() },
    )
    return
  }

  const phone = contact.phone_number.startsWith("+")
    ? contact.phone_number
    : `+${contact.phone_number}`

  // Unique phone guard: existing user with this phone but a different telegramId.
  const existingByPhone = await prisma.user.findUnique({
    where: { phoneNumber: phone },
    select: { telegramId: true },
  })
  if (
    existingByPhone &&
    existingByPhone.telegramId !== String(ctx.from.id)
  ) {
    await ctx.reply(
      "⚠️ This phone number is already registered to another account.",
    )
    return
  }

  const fullName =
    [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ").trim() ||
    "User"

  const saved = await prisma.user.upsert({
    where: { telegramId: String(ctx.from.id) },
    update: { name: fullName, phoneNumber: phone },
    create: {
      telegramId: String(ctx.from.id),
      name: fullName,
      phoneNumber: phone,
    },
    select: { name: true },
  })

  await ctx.reply(registerCompleteMessage(saved.name), {
    parse_mode: "HTML",
    reply_markup: mainMenuKeyboard(),
  })
})