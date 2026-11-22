import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import {
  lotteryListMessage,
  lotteryEmptyMessage,
  lotteryDetailMessage,
  notRegisteredMessage,
} from "../ui"
import {
  lotteryListKeyboard,
  lotteryDetailKeyboard,
  phoneRequestKeyboard,
} from "@/lib/bot/keyboard"

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

async function sendLotteryList(ctx: {
  reply: (text: string, extra?: object) => Promise<unknown>
}) {
  const rows = await prisma.lottery.findMany({
    where: { status: "ACTIVE" },
    orderBy: { drawDate: "asc" },
    select: { id: true, name: true },
  })

  if (rows.length === 0) {
    await ctx.reply(lotteryEmptyMessage(), { parse_mode: "HTML" })
    return
  }

  await ctx.reply(lotteryListMessage(), {
    parse_mode: "HTML",
    reply_markup: lotteryListKeyboard(rows),
  })
}

bot.command("lottery", async (ctx) => {
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.reply(notRegisteredMessage(), {
      reply_markup: phoneRequestKeyboard(),
    })
    return
  }
  await sendLotteryList(ctx)
})

bot.callbackQuery("l:list", async (ctx) => {
  await ctx.answerCallbackQuery()
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.editMessageText(notRegisteredMessage())
    return
  }
  const rows = await prisma.lottery.findMany({
    where: { status: "ACTIVE" },
    orderBy: { drawDate: "asc" },
    select: { id: true, name: true },
  })
  if (rows.length === 0) {
    await ctx.editMessageText(lotteryEmptyMessage(), { parse_mode: "HTML" })
    return
  }
  await ctx.editMessageText(lotteryListMessage(), {
    parse_mode: "HTML",
    reply_markup: lotteryListKeyboard(rows),
  })
})

bot.callbackQuery(/^l:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const lotteryId = ctx.match[1]

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { _count: { select: { tickets: true } } },
  })
  if (!lottery) {
    await ctx.editMessageText("Lottery not found.", {
      reply_markup: lotteryListKeyboard([]),
    })
    return
  }

  const canBuy =
    lottery.status === "ACTIVE" &&
    (lottery.totalTickets === null ||
      lottery._count.tickets < lottery.totalTickets)

  await ctx.editMessageText(
    lotteryDetailMessage({
      name: lottery.name,
      description: lottery.description,
      ticketPriceEtb: toNum(lottery.ticketPriceEtb),
      totalTickets: lottery.totalTickets,
      ticketsSold: lottery._count.tickets,
      drawDate: lottery.drawDate,
      status: lottery.status,
    }),
    {
      parse_mode: "HTML",
      reply_markup: lotteryDetailKeyboard(lottery.id, canBuy),
    },
  )
})