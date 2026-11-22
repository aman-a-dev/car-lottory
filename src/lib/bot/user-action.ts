"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/get-user"
import type { SubmitPaymentInput } from "@/lib/schema"
import {
  submitPaymentForUser,
  submitPaymentImageForUser,
  type SubmitPaymentResult,
} from "@/lib/bot/payment-service"

export type { SubmitPaymentResult }

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

// ---------- Reads (unchanged) ----------

export async function getAllLottery() {
  const rows = await prisma.lottery.findMany({
    where: { status: "ACTIVE" },
    orderBy: { drawDate: "asc" },
    include: { images: { orderBy: { isCover: "desc" } } },
  })

  const ids = rows.map((r) => r.id)
  const validCounts =
    ids.length === 0
      ? []
      : await prisma.ticket.groupBy({
        by: ["lotteryId"],
        where: { lotteryId: { in: ids }, status: { not: "VOID" } },
        _count: { _all: true },
      })
  const soldByLottery = new Map(
    validCounts.map((c) => [c.lotteryId, c._count._all] as const),
  )

  return rows.map((l) => {
    const sold = soldByLottery.get(l.id) ?? 0
    return {
      id: l.id,
      name: l.name,
      description: l.description,
      ticketPriceEtb: toNum(l.ticketPriceEtb),
      totalTickets: l.totalTickets,
      drawDate: l.drawDate,
      status: l.status,
      images: l.images.map((img) => ({
        id: img.id,
        url: img.url,
        isCover: img.isCover,
      })),
      ticketsSold: sold,
      ticketsRemaining:
        l.totalTickets === null ? null : Math.max(l.totalTickets - sold, 0),
    }
  })
}

export async function getUserTickets(userId?: string) {
  const user = await requireUser()
  const targetId = userId ?? user.id
  if (targetId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden")
  }

  const rows = await prisma.ticket.findMany({
    where: { userId: targetId },
    orderBy: { purchasedAt: "desc" },
    include: {
      lottery: { include: { images: { orderBy: { isCover: "desc" } } } },
      payment: true,
      winningDraw: true,
    },
  })

  return rows.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    status: t.status,
    purchasedAt: t.purchasedAt,
    lottery: {
      id: t.lottery.id,
      name: t.lottery.name,
      drawDate: t.lottery.drawDate,
      status: t.lottery.status,
      ticketPriceEtb: toNum(t.lottery.ticketPriceEtb),
      images: t.lottery.images.map((img) => ({
        id: img.id,
        url: img.url,
        isCover: img.isCover,
      })),
    },
    payment: {
      id: t.payment.id,
      amountEtb: toNum(t.payment.amountEtb),
      status: t.payment.status,
      verifiedAt: t.payment.verifiedAt,
    },
    winningDraw: t.winningDraw
      ? { id: t.winningDraw.id, drawTimestamp: t.winningDraw.drawTimestamp }
      : null,
  }))
}

// ---------- Payment submission (thin wrappers) ----------

export async function submitPayment(
  input: SubmitPaymentInput,
): Promise<SubmitPaymentResult> {
  const user = await requireUser()
  const result = await submitPaymentForUser(user, input)
  if (result.ok) {
    revalidatePath("/lottery")
    revalidatePath("/ticket")
    revalidatePath("/profile")
  }
  return result
}

export async function submitPaymentImage(input: {
  lotteryId: string
  amountEtb: number
  images: string[]
}): Promise<SubmitPaymentResult> {
  const user = await requireUser()
  const result = await submitPaymentImageForUser(user, input)
  if (result.ok) {
    revalidatePath("/lottery")
    revalidatePath("/ticket")
    revalidatePath("/profile")
  }
  return result
}