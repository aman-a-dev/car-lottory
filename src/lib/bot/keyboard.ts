import "server-only"
import { InlineKeyboard, Keyboard } from "grammy"

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .text("🎰 Available Lotteries", "l:list")
    .row()
    .text("🎟 My Tickets", "t:list")
    .row()
    .text("👤 My Profile", "profile")
    .row()
    .text("🆘 Support", "support")
}

export function lotteryListKeyboard(lotteries: { id: string; name: string }[]) {
  const kb = new InlineKeyboard()
  for (const l of lotteries) {
    kb.text(`🎰 ${l.name}`, `l:view:${l.id}`).row()
  }
  kb.text("🏠 Main Menu", "menu")
  return kb
}

export function lotteryDetailKeyboard(lotteryId: string, canBuy: boolean) {
  const kb = new InlineKeyboard()
  if (canBuy) kb.text("🎟 Buy Ticket", `l:buy:${lotteryId}`).row()
  kb.text("🔙 Back to Lotteries", "l:list")
  return kb
}

export function purchaseInstructionsKeyboard(lotteryId: string) {
  return new InlineKeyboard()
    .text("💳 Payment Instructions", `pay:info:${lotteryId}`)
    .row()
    .text("🔙 Back", `l:view:${lotteryId}`)
}

export function successKeyboard() {
  return new InlineKeyboard()
    .text("🎟 My Tickets", "t:list")
    .row()
    .text("🎰 Available Lotteries", "l:list")
    .row()
    .text("🏠 Main Menu", "menu")
}

export function failKeyboard(lotteryId: string) {
  return new InlineKeyboard()
    .text("🔄 Try Again", `pay:retry:${lotteryId}`)
    .row()
    .text("🆘 Contact Support", "support")
    .row()
    .text("🏠 Main Menu", "menu")
}

export function ticketListKeyboard(
  tickets: { id: string; ticketNumber: string }[],
) {
  const kb = new InlineKeyboard()
  for (const t of tickets) {
    kb.text(`🔍 View #${t.ticketNumber}`, `t:view:${t.id}`).row()
  }
  kb.text("🏠 Main Menu", "menu")
  return kb
}

export function ticketDetailKeyboard() {
  return new InlineKeyboard()
    .text("🎟 All Tickets", "t:list")
    .row()
    .text("🏠 Main Menu", "menu")
}

export function profileKeyboard() {
  return new InlineKeyboard()
    .text("🎟 My Tickets", "t:list")
    .row()
    .text("🏠 Main Menu", "menu")
}

export function supportKeyboard() {
  return new InlineKeyboard()
    .url("💬 Contact Support", "https://t.me/Aman_a_dev")
    .row()
    .text("🏠 Main Menu", "menu")
}

export function backToMenuKeyboard() {
  return new InlineKeyboard().text("🏠 Main Menu", "menu")
}

export function phoneRequestKeyboard() {
  return new Keyboard()
    .requestContact("📱 Share Phone Number")
    .resized()
    .oneTime()
}