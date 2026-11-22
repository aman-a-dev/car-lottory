import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import { startPendingPurchase, peekPendingPurchase } from "../session"
import {
  purchaseInstructionsMessage,
  awaitReceiptMessage,
  paymentInstructionsMessage,
  notRegisteredMessage,
} from "../ui"
import {
  purchaseInstructionsKeyboard,
  backToMenuKeyboard,
} from "../keyboard"

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

bot.callbackQuery(/^l:buy:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const lotteryId = ctx.match[1]
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.editMessageText(notRegisteredMessage(), {
      reply_markup: backToMenuKeyboard(),
    })
    return
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { id: true, name: true, ticketPriceEtb: true, status: true, totalTickets: true },
  })
  if (!lottery || lottery.status !== "ACTIVE") {
    await ctx.editMessageText("This lottery is no longer available.", {
      reply_markup: backToMenuKeyboard(),
    })
    return
  }

  const sold = await prisma.ticket.count({
    where: { lotteryId, status: { not: "VOID" } },
  })
  if (lottery.totalTickets !== null && sold >= lottery.totalTickets) {
    await ctx.editMessageText("This lottery is sold out.", {
      reply_markup: backToMenuKeyboard(),
    })
    return
  }

  const price = toNum(lottery.ticketPriceEtb)
  startPendingPurchase(String(ctx.from!.id), {
    userId: user.id,
    lotteryId: lottery.id,
    expectedAmountEtb: price,
  })

  await ctx.editMessageText(
    purchaseInstructionsMessage(lottery.name, price),
    {
      parse_mode: "HTML",
      reply_markup: purchaseInstructionsKeyboard(lottery.id),
    },
  )

  // Follow-up prompt with the receipt ask.
  await ctx.reply(awaitReceiptMessage(), { parse_mode: "HTML" })
})

bot.callbackQuery(/^pay:info:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const lotteryId = ctx.match[1]
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { name: true, ticketPriceEtb: true },
  })
  if (!lottery) return
  await ctx.reply(
    paymentInstructionsMessage(lottery.name, toNum(lottery.ticketPriceEtb)),
    { parse_mode: "HTML" },
  )
})

bot.callbackQuery(/^pay:retry:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const lotteryId = ctx.match[1]
  const pending = peekPendingPurchase(String(ctx.from!.id))
  if (!pending || pending.lotteryId !== lotteryId) {
    await ctx.editMessageText(
      "Your pending purchase expired. Please start a new one.",
      { reply_markup: backToMenuKeyboard() },
    )
    return
  }
  await ctx.editMessageText(awaitReceiptMessage(), { parse_mode: "HTML" })
})