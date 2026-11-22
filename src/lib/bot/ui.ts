import "server-only"
import { formatEtb } from "@/lib/utils"

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
  )
}

export function welcomeMessage(): string {
  return [
    "🎉 <b>Welcome to Lottery!</b>",
    "",
    "Join exciting lotteries and get a chance to win amazing prizes.",
    "",
    "To get started, please share your phone number to register.",
  ].join("\n")
}

export function mainMenuMessage(name: string): string {
  return [
    `Welcome, <b>${escapeHtml(name)}</b>! 👋`,
    "",
    "What would you like to do today?",
  ].join("\n")
}

export function lotteryListMessage(): string {
  return [
    "🎰 <b>Available Lotteries</b>",
    "",
    "Choose a lottery below to see its details and participate.",
  ].join("\n")
}

export function lotteryEmptyMessage(): string {
  return [
    "🎰 <b>Available Lotteries</b>",
    "",
    "No active lotteries right now. Check back soon!",
  ].join("\n")
}

export interface LotteryDetailView {
  name: string
  description: string | null
  ticketPriceEtb: number
  totalTickets: number | null
  ticketsSold: number
  drawDate: Date
  status: "ACTIVE" | "CLOSED" | "DRAWN"
}

export function lotteryDetailMessage(l: LotteryDetailView): string {
  const lines = [`🎰 <b>${escapeHtml(l.name)}</b>`]
  if (l.description) lines.push(`📝 ${escapeHtml(l.description)}`)
  lines.push(`💰 <b>Ticket Price:</b> ${formatEtb(l.ticketPriceEtb)}`)
  lines.push(
    `🎟 <b>Tickets Purchased:</b> ${l.ticketsSold}${l.totalTickets ? ` / ${l.totalTickets}` : ""
    }`,
  )
  lines.push(
    `📅 <b>Draw Date:</b> ${l.drawDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
  )
  lines.push(`📊 <b>Status:</b> ${l.status}`)
  lines.push("")
  lines.push("Participate now for a chance to win!")
  return lines.join("\n")
}

export function purchaseInstructionsMessage(
  lotteryName: string,
  amountEtb: number,
): string {
  return [
    "🎟 <b>Purchase Your Ticket</b>",
    "",
    `Lottery: <b>${escapeHtml(lotteryName)}</b>`,
    `💰 Ticket Price: <b>${formatEtb(amountEtb)}</b>`,
    "",
    `Complete your payment of <b>${formatEtb(amountEtb)}</b> and submit your payment receipt to verify your purchase.`,
    "",
    "Once your payment is verified, your lottery ticket will be issued.",
  ].join("\n")
}

export function awaitReceiptMessage(): string {
  return [
    "📩 <b>Please send your payment receipt</b> (text, URL, or screenshot).",
    "",
    "Your payment will be reviewed. If valid, your lottery ticket will be issued automatically.",
  ].join("\n")
}

export function paymentSuccessMessage(p: {
  lotteryName: string
  ticketNumbers: string[]
  amountEtb: number
}): string {
  const lines = [
    "✅ <b>Payment Verified Successfully!</b>",
    "",
    "Your payment has been confirmed.",
    "🎉 <b>Your lottery ticket has been issued!</b>",
    "",
    `🎰 Lottery: <b>${escapeHtml(p.lotteryName)}</b>`,
  ]
  if (p.ticketNumbers.length === 1) {
    lines.push(`🎟 Ticket Number: <code>${p.ticketNumbers[0]}</code>`)
  } else {
    lines.push(`🎟 Tickets (${p.ticketNumbers.length}):`)
    for (const n of p.ticketNumbers) lines.push(`  • <code>${n}</code>`)
  }
  lines.push(`💰 Amount Paid: <b>${formatEtb(p.amountEtb)}</b>`)
  lines.push("")
  lines.push("Good luck! 🍀")
  return lines.join("\n")
}

export function paymentFailedMessage(detail?: string): string {
  const lines = [
    "❌ <b>Payment Verification Failed</b>",
    "",
    "We couldn't verify your payment.",
    "",
    "Possible reasons:",
    "▪ Invalid receipt",
    "▪ Incorrect payment amount",
    "▪ Transaction not completed",
    "▪ Receipt already used",
    "▪ Payment information couldn't be verified",
    "",
    "Please check your payment information and try again.",
  ]
  if (detail) lines.push("", `<i>${escapeHtml(detail)}</i>`)
  lines.push("", "If you need assistance, contact support: @Aman_a_dev")
  return lines.join("\n")
}

export function paymentPendingMessage(): string {
  return [
    "⏳ <b>Payment Pending Verification</b>",
    "",
    "Your payment is being verified by the bank. This may take a few minutes.",
    "",
    "No action needed on your side — you'll receive a confirmation once it's resolved.",
  ].join("\n")
}

export function myTicketsEmptyMessage(): string {
  return [
    "🎟 <b>My Tickets</b>",
    "",
    "You don't have any tickets yet.",
    "",
    "Browse available lotteries to get started!",
  ].join("\n")
}

export function myTicketsHeaderMessage(count: number): string {
  return [
    "🎟 <b>My Tickets</b>",
    "",
    `You own ${count} ticket${count === 1 ? "" : "s"}. Tap one to view details.`,
  ].join("\n")
}

export function ticketDetailMessage(t: {
  ticketNumber: string
  lotteryName: string
  status: string
  purchasedAt: Date
}): string {
  return [
    "🎟 <b>Ticket Details</b>",
    "",
    `Ticket Number: <code>${t.ticketNumber}</code>`,
    `Lottery: <b>${escapeHtml(t.lotteryName)}</b>`,
    `Status: <b>${t.status}</b>`,
    `Purchase Date: ${t.purchasedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    "",
    "🍀 Good luck!",
  ].join("\n")
}

export function profileMessage(p: {
  name: string
  phoneNumber: string | null
  telegramId: string
  totalTickets: number
  createdAt: Date
}): string {
  return [
    "👤 <b>My Profile</b>",
    "",
    `Name: <b>${escapeHtml(p.name)}</b>`,
    `Phone: ${p.phoneNumber ? escapeHtml(p.phoneNumber) : "—"}`,
    `Telegram ID: <code>${p.telegramId}</code>`,
    `Total Tickets: ${p.totalTickets}`,
    `Joined: ${p.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    "",
    "Your account information.",
  ].join("\n")
}

export function supportMessage(): string {
  return [
    "🆘 <b>Lottery Support</b>",
    "",
    "Need assistance with payments, tickets, registration, or lottery information?",
    "",
    "Contact our support team on Telegram. We're happy to help you.",
  ].join("\n")
}

export function paymentInstructionsMessage(
  lotteryName: string,
  amountEtb: number,
): string {
  const accounts =
    process.env.PAYMENT_ACCOUNTS ??
    [
      "• Telebirr: <code>0912345678</code>",
      "• CBE: <code>1000123456789</code>",
    ].join("\n")

  return [
    "💳 <b>Payment Instructions</b>",
    "",
    `Lottery: <b>${escapeHtml(lotteryName)}</b>`,
    `Amount: <b>${formatEtb(amountEtb)}</b>`,
    "",
    "Send the amount to one of the accounts below, then return and submit your receipt:",
    "",
    accounts,
  ].join("\n")
}

export function unknownCommandMessage(): string {
  return "Unknown command. Use /menu to see available options."
}

export function notRegisteredMessage(): string {
  return "Please share your phone number to register first."
}

export function registerCompleteMessage(name: string): string {
  return [
    "✅ <b>Registration complete!</b>",
    "",
    `Welcome, <b>${escapeHtml(name)}</b>! 👋`,
    "",
    "What would you like to do today?",
  ].join("\n")
}