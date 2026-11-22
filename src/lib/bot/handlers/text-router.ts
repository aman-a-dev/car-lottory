import type { Context, Filter } from "grammy"
import { bot } from "../instance"
import prisma from "@/lib/prisma"
import { findBotUser } from "../user"
import {
  peekPendingPurchase,
  clearPendingPurchase,
  type PendingPurchase,
} from "../session"
import {
  submitPaymentForUser,
  submitPaymentImageForUser,
} from "@/lib/bot/payment-service"
import {
  awaitReceiptMessage,
  paymentSuccessMessage,
  paymentFailedMessage,
  paymentPendingMessage,
  notRegisteredMessage,
  unknownCommandMessage,
} from "../ui"
import {
  successKeyboard,
  failKeyboard,
  mainMenuKeyboard,
  phoneRequestKeyboard,
} from "@/lib/bot/keyboard"

type TextCtx = Filter<Context, "message:text">
type PhotoCtx = Filter<Context, "message:photo">

// ---------- Text (URL / reference / unknown) ----------

bot.on("message:text", async (ctx) => {
  if (!ctx.from) return
  const text = ctx.message.text.trim()

  // Commands fall through here only if no command handler matched.
  if (text.startsWith("/")) {
    const user = await findBotUser(ctx)
    if (!user) {
      await ctx.reply(notRegisteredMessage(), {
        reply_markup: phoneRequestKeyboard(),
      })
      return
    }
    await ctx.reply(unknownCommandMessage(), {
      reply_markup: mainMenuKeyboard(),
    })
    return
  }

  const pending = peekPendingPurchase(String(ctx.from.id))
  if (pending) {
    await handleTextReceipt(ctx, pending, text)
    return
  }

  // Not a receipt → route based on registration state.
  const user = await findBotUser(ctx)
  if (!user) {
    await ctx.reply(notRegisteredMessage(), {
      reply_markup: phoneRequestKeyboard(),
    })
    return
  }
  await ctx.reply("Use the menu below to get started.", {
    reply_markup: mainMenuKeyboard(),
  })
})

async function handleTextReceipt(
  ctx: TextCtx,
  pending: PendingPurchase,
  receiptText: string,
): Promise<void> {
  const telegramId = String(ctx.from!.id)
  const lottery = await prisma.lottery.findUnique({
    where: { id: pending.lotteryId },
    select: { name: true },
  })

  const result = await submitPaymentForUser(
    { id: pending.userId },
    {
      lotteryId: pending.lotteryId,
      receiptText,
      amountEtb: pending.expectedAmountEtb,
    },
  )

  if (result.ok) {
    clearPendingPurchase(telegramId)
    await ctx.reply(
      paymentSuccessMessage({
        lotteryName: lottery?.name ?? "Lottery",
        ticketNumbers: result.ticketNumbers,
        amountEtb: pending.expectedAmountEtb,
      }),
      { parse_mode: "HTML", reply_markup: successKeyboard() },
    )
    return
  }

  // Keep the pending purchase only when the user could fix it by retrying.
  const keepPending =
    result.reason === "verification_failed" || result.reason === "duplicate"
  if (!keepPending) {
    clearPendingPurchase(telegramId)
  }

  if (result.reason === "pending") {
    await ctx.reply(paymentPendingMessage(), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    })
    return
  }

  if (keepPending) {
    await ctx.reply(paymentFailedMessage(result.detail), {
      parse_mode: "HTML",
      reply_markup: failKeyboard(pending.lotteryId),
    })
    await ctx.reply(awaitReceiptMessage(), { parse_mode: "HTML" })
    return
  }

  await ctx.reply(paymentFailedMessage(result.detail), {
    parse_mode: "HTML",
    reply_markup: failKeyboard(pending.lotteryId),
  })
}

// ---------- Photo (receipt screenshot) ----------

bot.on("message:photo", async (ctx) => {
  if (!ctx.from) return

  const pending = peekPendingPurchase(String(ctx.from.id))
  if (!pending) {
    const user = await findBotUser(ctx)
    if (!user) {
      await ctx.reply(notRegisteredMessage(), {
        reply_markup: phoneRequestKeyboard(),
      })
      return
    }
    await ctx.reply(
      "No pending purchase. Open a lottery and tap 🎟 Buy Ticket first.",
      { reply_markup: mainMenuKeyboard() },
    )
    return
  }

  await handlePhotoReceipt(ctx, pending)
})

async function handlePhotoReceipt(
  ctx: PhotoCtx,
  pending: PendingPurchase,
): Promise<void> {
  const telegramId = String(ctx.from!.id)
  const photo = ctx.message.photo[ctx.message.photo.length - 1]

  let base64: string
  try {
    const file = await ctx.api.getFile(photo.file_id)
    if (!file.file_path) throw new Error("No file path on Telegram file")
    const token = process.env.BOT_TOKEN!
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to download: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    base64 = buf.toString("base64")
  } catch (err) {
    console.error("[bot] image download failed", err)
    await ctx.reply(
      "⚠️ Couldn't download the image. Please try again or send your receipt as text/URL.",
      { reply_markup: failKeyboard(pending.lotteryId) },
    )
    return
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: pending.lotteryId },
    select: { name: true },
  })

  const result = await submitPaymentImageForUser(
    { id: pending.userId },
    {
      lotteryId: pending.lotteryId,
      amountEtb: pending.expectedAmountEtb,
      images: [base64],
    },
  )

  if (result.ok) {
    clearPendingPurchase(telegramId)
    await ctx.reply(
      paymentSuccessMessage({
        lotteryName: lottery?.name ?? "Lottery",
        ticketNumbers: result.ticketNumbers,
        amountEtb: pending.expectedAmountEtb,
      }),
      { parse_mode: "HTML", reply_markup: successKeyboard() },
    )
    return
  }

  const keepPending =
    result.reason === "verification_failed" || result.reason === "duplicate"
  if (!keepPending) {
    clearPendingPurchase(telegramId)
  }

  if (result.reason === "pending") {
    await ctx.reply(paymentPendingMessage(), {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(),
    })
    return
  }

  if (keepPending) {
    await ctx.reply(paymentFailedMessage(result.detail), {
      parse_mode: "HTML",
      reply_markup: failKeyboard(pending.lotteryId),
    })
    await ctx.reply(awaitReceiptMessage(), { parse_mode: "HTML" })
    return
  }

  await ctx.reply(paymentFailedMessage(result.detail), {
    parse_mode: "HTML",
    reply_markup: failKeyboard(pending.lotteryId),
  })
}