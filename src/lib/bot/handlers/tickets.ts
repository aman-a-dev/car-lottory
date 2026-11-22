import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import {
  myTicketsEmptyMessage,
  myTicketsHeaderMessage,
  ticketDetailMessage,
  notRegisteredMessage,
} from "../ui"
import {
  ticketListKeyboard,
  ticketDetailKeyboard,
  phoneRequestKeyboard,
  backToMenuKeyboard,
} from "@/lib/bot/keyboard"

async function sendTicketsList(
  ctx: { reply: (t: string, x?: object) => Promise<unknown> },
) {
  const user = await findBotUser(ctx as never)
  if (!user) {
    await ctx.reply(notRegisteredMessage(), {
      reply_markup: phoneRequestKeyboard(),
    })
    return
  }

  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, ticketNumber: true },
    take: 20,
  })

  if (tickets.length === 0) {
    await ctx.reply(myTicketsEmptyMessage(), { parse_mode: "HTML" })
    return
  }

  await ctx.reply(myTicketsHeaderMessage(tickets.length), {
    parse_mode: "HTML",
    reply_markup: ticketListKeyboard(tickets),
  })
}

bot.command("tickets", async (ctx) => {
  await sendTicketsList(ctx)
})

bot.callbackQuery("t:list", async (ctx) => {
  await ctx.answerCallbackQuery()
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.editMessageText(notRegisteredMessage())
    return
  }
  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    orderBy: { purchasedAt: "desc" },
    select: { id: true, ticketNumber: true },
    take: 20,
  })
  if (tickets.length === 0) {
    await ctx.editMessageText(myTicketsEmptyMessage(), { parse_mode: "HTML" })
    return
  }
  await ctx.editMessageText(myTicketsHeaderMessage(tickets.length), {
    parse_mode: "HTML",
    reply_markup: ticketListKeyboard(tickets),
  })
})

bot.callbackQuery(/^t:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const ticketId = ctx.match[1]
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.editMessageText(notRegisteredMessage(), {
      reply_markup: backToMenuKeyboard(),
    })
    return
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId: user.id },
    include: { lottery: { select: { name: true } } },
  })
  if (!ticket) {
    await ctx.editMessageText("Ticket not found.", {
      reply_markup: backToMenuKeyboard(),
    })
    return
  }

  await ctx.editMessageText(
    ticketDetailMessage({
      ticketNumber: ticket.ticketNumber,
      lotteryName: ticket.lottery.name,
      status: ticket.status,
      purchasedAt: ticket.purchasedAt,
    }),
    { parse_mode: "HTML", reply_markup: ticketDetailKeyboard() },
  )
})