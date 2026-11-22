// import prisma from "@/lib/prisma"
// import { revalidatePath } from "next/cache";

// export function getAllLottory() {
//   return
// }

// export function submitPayment() {
//   return
// }

// export function getUserTickets(id: string) {
//   return
// }

"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireUser } from "@/lib/get-user"
import { submitPaymentSchema, type SubmitPaymentInput } from "@/lib/schema"
import {
  LinksEtError,
  verifyReceipt,
  verifyReceiptImage,
  getVerifiedReceiptFromImageResult,
  type VerifyReceipt,
  type VerifyResult,
} from "@/lib/payment"
import type { Prisma } from "@/generated/prisma/client"
import { createHash } from "node:crypto"

// ---------- Serialization helpers ----------

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  // links.et responses are parsed from JSON, so this is already JSON-safe.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

// ---------- Reads ----------

/**
 * Active lotteries for the user-facing list, with cover image + remaining count.
 */
export async function getAllLottery() {
  //await requireUser()

  const rows = await prisma.lottery.findMany({
    where: { status: "ACTIVE" },
    orderBy: { drawDate: "asc" },
    include: {
      images: { orderBy: { isCover: "desc" } },
    },
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

/**
 * Tickets for a user. Pass `userId` explicitly to view someone else's tickets
 * (admins only); otherwise defaults to the signed-in user.
 */
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

// ---------- Payment submission ----------

export type SubmitPaymentResult =
  | {
    ok: true
    paymentId: string
    ticketCount: number
  }
  | {
    ok: false
    paymentId: string
    reason:
    | "pending"
    | "verification_failed"
    | "amount_too_low"
    | "capacity_exceeded"
    | "error"
    detail?: string
  }

/**
 * Verifies a receipt with links.et and, on success, mints the user's tickets.
 *
 * Flow:
 *   1. Verify (short `waitMs` so we don't blow Vercel's function timeout).
 *   2. Persist Payment row immediately (unique `receiptText` blocks duplicates).
 *   3. On verified + sufficient capacity, create tickets in one transaction.
 *   4. Unresolved (202 / retryable) → payment stays `PENDING` for later reconciliation.
 */
export async function submitPayment(
  input: SubmitPaymentInput,
): Promise<SubmitPaymentResult> {
  const user = await requireUser()
  const parsed = submitPaymentSchema.parse(input)

  // Block duplicates early (the DB unique index is the real guard).
  const duplicate = await prisma.payment.findUnique({
    where: { receiptText: parsed.receiptText },
    select: { id: true },
  })
  if (duplicate) {
    throw new Error("This receipt has already been submitted.")
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: parsed.lotteryId },
  })
  if (!lottery) throw new Error("Lottery not found")
  if (lottery.status !== "ACTIVE") throw new Error("Lottery is not active")

  // ---- 1. Verify with links.et ----
  const isUrl = /^https?:\/\//i.test(parsed.receiptText)
  let verify: VerifyResult | null = null
  let verifyError: { code: string; message: string; retryable: boolean } | null = null

  try {
    verify = await verifyReceipt(
      isUrl
        ? { url: parsed.receiptText, waitMs: 5000 }
        : { reference: parsed.receiptText, waitMs: 5000 },
    )
  } catch (err) {
    if (err instanceof LinksEtError) {
      verifyError = { code: err.code, message: err.message, retryable: err.retryable }
    } else {
      verifyError = {
        code: "unknown_error",
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      }
    }
  }

  const verifiedReceipt: VerifyReceipt | undefined =
    verify && "ok" in verify && verify.ok ? verify.receipt : undefined

  const isQueued = verify !== null && "processingStatus" in verify
  const isHardFailure =
    verifyError !== null && verifyError.retryable === false

  // ---- 2. Persist payment ----
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      lotteryId: parsed.lotteryId,
      receiptText: parsed.receiptText,
      amountEtb: parsed.amountEtb,
      status: isHardFailure ? "FAILED" : "PENDING",
      providerRaw: toJsonSafe(
        verifiedReceipt
          ? { status: "verified", receipt: verifiedReceipt }
          : isQueued
            ? { status: "queued", queued: verify }
            : { status: "unverified", error: verifyError },
      ),
    },
    select: { id: true },
  })

  if (!verifiedReceipt) {
    if (isHardFailure) {
      return {
        ok: false,
        paymentId: payment.id,
        reason: "verification_failed",
        detail: verifyError?.message,
      }
    }
    // 202 queued, network error, retryable links.et error, or timeout.
    return { ok: false, paymentId: payment.id, reason: "pending" }
  }

  // ---- 3. Compute tickets ----
  const amountCents = Math.round(parsed.amountEtb * 100)
  const priceCents = Math.round(toNum(lottery.ticketPriceEtb) * 100)
  const ticketCount = Math.floor(amountCents / priceCents)

  if (ticketCount < 1) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    })
    return { ok: false, paymentId: payment.id, reason: "amount_too_low" }
  }

  // ---- 4. Issue tickets in a transaction ----
  try {
    await prisma.$transaction(async (tx) => {
      // Re-check capacity inside the tx.
      if (lottery.totalTickets !== null) {
        const issued = await tx.ticket.count({
          where: { lotteryId: lottery.id, status: { not: "VOID" } },
        })
        if (issued + ticketCount > lottery.totalTickets) {
          throw new CapacityError()
        }
      }

      // Next ticket number — zero-padded so string ordering == numeric ordering.
      const maxRows = await tx.$queryRaw<{ max: bigint | number | null }[]>`
        SELECT MAX(CAST(ticket_number AS INTEGER)) AS max
        FROM tickets
        WHERE lottery_id = ${lottery.id}
      `
      const start = Number(maxRows[0]?.max ?? 0) + 1

      const data = Array.from({ length: ticketCount }, (_, i) => ({
        userId: user.id,
        lotteryId: lottery.id,
        paymentId: payment.id,
        ticketNumber: String(start + i).padStart(8, "0"),
      }))

      await tx.ticket.createMany({ data })
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", verifiedAt: new Date() },
      })
    })
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    })
    if (err instanceof CapacityError) {
      return { ok: false, paymentId: payment.id, reason: "capacity_exceeded" }
    }
    // Unique violation on (lotteryId, ticketNumber) — extremely rare; surface as error.
    return {
      ok: false,
      paymentId: payment.id,
      reason: "error",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  revalidatePath("/lottery")
  revalidatePath("/ticket")
  revalidatePath("/profile")

  return { ok: true, paymentId: payment.id, ticketCount }
}

class CapacityError extends Error {
  constructor() {
    super("Not enough tickets remaining")
    this.name = "CapacityError"
  }
}



export interface SubmitPaymentImageInput {
  lotteryId: string
  amountEtb: number
  /** Base64 (no data-URL prefix) JPEG/PNG images of the receipt. 1–5. */
  images: string[]
}

/**
 * Same flow as `submitPayment`, but takes receipt screenshots instead of a URL.
 * The unique `receiptText` is derived from a hash of the images so re-submitting
 * the same screenshot is blocked by the DB unique index.
 */
export async function submitPaymentImage(
  input: SubmitPaymentImageInput,
): Promise<SubmitPaymentResult> {
  const user = await requireUser()
  if (input.images.length < 1 || input.images.length > 5) {
    throw new Error("Upload between 1 and 5 receipt images")
  }

  const parsedAmount = submitPaymentSchema.parse({
    lotteryId: input.lotteryId,
    receiptText: "placeholder",
    amountEtb: input.amountEtb,
  })

  // Deterministic key → duplicate screenshots get rejected by the unique index.
  const hash = createHash("sha256")
    .update(input.images.join("|"))
    .digest("hex")
    .slice(0, 32)
  const receiptText = `img:${hash}`

  const lottery = await prisma.lottery.findUnique({ where: { id: parsedAmount.lotteryId } })
  if (!lottery) throw new Error("Lottery not found")
  if (lottery.status !== "ACTIVE") throw new Error("Lottery is not active")

  let verifiedReceipt: VerifyReceipt | undefined
  let providerRaw: Prisma.InputJsonValue = { status: "unverified" }

  try {
    const result = await verifyReceiptImage({
      images: input.images.map((b64) => ({ imageBase64: b64 })),
    })
    verifiedReceipt = getVerifiedReceiptFromImageResult(result)
    providerRaw = JSON.parse(
      JSON.stringify(verifiedReceipt ? { status: "verified", receipt: verifiedReceipt } : { status: "unverified", result }),
    ) as Prisma.InputJsonValue
  } catch (err) {
    if (err instanceof LinksEtError && !err.retryable) {
      const failed = await prisma.payment.create({
        data: {
          userId: user.id,
          lotteryId: parsedAmount.lotteryId,
          receiptText,
          amountEtb: parsedAmount.amountEtb,
          status: "FAILED",
          providerRaw: { status: "error", code: err.code, message: err.message },
        },
        select: { id: true },
      })
      return { ok: false, paymentId: failed.id, reason: "verification_failed", detail: err.message }
    }
    // retryable or unknown → leave pending for later reconciliation
  }

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      lotteryId: parsedAmount.lotteryId,
      receiptText,
      amountEtb: parsedAmount.amountEtb,
      status: verifiedReceipt ? "PENDING" : "PENDING",
      providerRaw,
    },
    select: { id: true },
  })

  if (!verifiedReceipt) {
    return { ok: false, paymentId: payment.id, reason: "pending" }
  }

  // Same ticket-minting logic as submitPayment — extract it if you plan to grow this.
  const amountCents = Math.round(parsedAmount.amountEtb * 100)
  const priceCents = Math.round(toNum(lottery.ticketPriceEtb) * 100)
  const ticketCount = Math.floor(amountCents / priceCents)
  if (ticketCount < 1) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } })
    return { ok: false, paymentId: payment.id, reason: "amount_too_low" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (lottery.totalTickets !== null) {
        const issued = await tx.ticket.count({
          where: { lotteryId: lottery.id, status: { not: "VOID" } },
        })
        if (issued + ticketCount > lottery.totalTickets) throw new CapacityError()
      }
      const maxRows = await tx.$queryRaw<{ max: bigint | number | null }[]>`
        SELECT MAX(CAST(ticket_number AS INTEGER)) AS max
        FROM tickets WHERE lottery_id = ${lottery.id}
      `
      const start = Number(maxRows[0]?.max ?? 0) + 1
      await tx.ticket.createMany({
        data: Array.from({ length: ticketCount }, (_, i) => ({
          userId: user.id,
          lotteryId: lottery.id,
          paymentId: payment.id,
          ticketNumber: String(start + i).padStart(8, "0"),
        })),
      })
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", verifiedAt: new Date() },
      })
    })
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } })
    if (err instanceof CapacityError) {
      return { ok: false, paymentId: payment.id, reason: "capacity_exceeded" }
    }
    return { ok: false, paymentId: payment.id, reason: "error", detail: String(err) }
  }

  revalidatePath("/lottery")
  revalidatePath("/ticket")
  revalidatePath("/profile")
  return { ok: true, paymentId: payment.id, ticketCount }
}