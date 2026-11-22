import "server-only"
import prisma from "@/lib/prisma"
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

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

class CapacityError extends Error {
  constructor() {
    super("Not enough tickets remaining")
    this.name = "CapacityError"
  }
}

export type SubmitPaymentResult =
  | {
    ok: true
    paymentId: string
    ticketCount: number
    ticketNumbers: string[]
  }
  | {
    ok: false
    paymentId: string | null
    reason:
    | "pending"
    | "verification_failed"
    | "amount_too_low"
    | "capacity_exceeded"
    | "duplicate"
    | "error"
    detail?: string
  }

export async function submitPaymentForUser(
  user: { id: string },
  input: SubmitPaymentInput,
): Promise<SubmitPaymentResult> {
  const parsed = submitPaymentSchema.parse(input)

  const duplicate = await prisma.payment.findUnique({
    where: { receiptText: parsed.receiptText },
    select: { id: true },
  })
  if (duplicate) {
    return {
      ok: false,
      paymentId: duplicate.id,
      reason: "duplicate",
      detail: "This receipt has already been submitted.",
    }
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: parsed.lotteryId },
  })
  if (!lottery) {
    return { ok: false, paymentId: null, reason: "error", detail: "Lottery not found" }
  }
  if (lottery.status !== "ACTIVE") {
    return { ok: false, paymentId: null, reason: "error", detail: "Lottery is not active" }
  }

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
  const isHardFailure = verifyError !== null && verifyError.retryable === false

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
    return { ok: false, paymentId: payment.id, reason: "pending" }
  }

  return issueTickets(user.id, lottery, payment.id, parsed.amountEtb)
}

export async function submitPaymentImageForUser(
  user: { id: string },
  input: { lotteryId: string; amountEtb: number; images: string[] },
): Promise<SubmitPaymentResult> {
  if (input.images.length < 1 || input.images.length > 5) {
    return {
      ok: false,
      paymentId: null,
      reason: "error",
      detail: "Upload between 1 and 5 images",
    }
  }

  const parsedAmount = submitPaymentSchema.parse({
    lotteryId: input.lotteryId,
    receiptText: "placeholder",
    amountEtb: input.amountEtb,
  })

  const hash = createHash("sha256")
    .update(input.images.join("|"))
    .digest("hex")
    .slice(0, 32)
  const receiptText = `img:${hash}`

  const duplicate = await prisma.payment.findUnique({
    where: { receiptText },
    select: { id: true },
  })
  if (duplicate) {
    return {
      ok: false,
      paymentId: duplicate.id,
      reason: "duplicate",
      detail: "This receipt has already been submitted.",
    }
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: parsedAmount.lotteryId },
  })
  if (!lottery) {
    return { ok: false, paymentId: null, reason: "error", detail: "Lottery not found" }
  }
  if (lottery.status !== "ACTIVE") {
    return { ok: false, paymentId: null, reason: "error", detail: "Lottery is not active" }
  }

  let verifiedReceipt: VerifyReceipt | undefined
  let providerRaw: Prisma.InputJsonValue = { status: "unverified" }

  try {
    const result = await verifyReceiptImage({
      images: input.images.map((b64) => ({ imageBase64: b64 })),
    })
    verifiedReceipt = getVerifiedReceiptFromImageResult(result)
    providerRaw = JSON.parse(
      JSON.stringify(
        verifiedReceipt
          ? { status: "verified", receipt: verifiedReceipt }
          : { status: "unverified", result },
      ),
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
      return {
        ok: false,
        paymentId: failed.id,
        reason: "verification_failed",
        detail: err.message,
      }
    }
  }

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      lotteryId: parsedAmount.lotteryId,
      receiptText,
      amountEtb: parsedAmount.amountEtb,
      status: "PENDING",
      providerRaw,
    },
    select: { id: true },
  })

  if (!verifiedReceipt) {
    return { ok: false, paymentId: payment.id, reason: "pending" }
  }

  return issueTickets(user.id, lottery, payment.id, parsedAmount.amountEtb)
}

async function issueTickets(
  userId: string,
  lottery: {
    id: string
    totalTickets: number | null
    ticketPriceEtb: { toString(): string }
  },
  paymentId: string,
  amountEtb: number,
): Promise<SubmitPaymentResult> {
  const amountCents = Math.round(amountEtb * 100)
  const priceCents = Math.round(toNum(lottery.ticketPriceEtb) * 100)
  const ticketCount = Math.floor(amountCents / priceCents)

  if (ticketCount < 1) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "FAILED" },
    })
    return { ok: false, paymentId, reason: "amount_too_low" }
  }

  let ticketNumbers: string[] = []

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
      ticketNumbers = Array.from({ length: ticketCount }, (_, i) =>
        String(start + i).padStart(8, "0"),
      )

      await tx.ticket.createMany({
        data: ticketNumbers.map((n) => ({
          userId,
          lotteryId: lottery.id,
          paymentId,
          ticketNumber: n,
        })),
      })
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "SUCCESS", verifiedAt: new Date() },
      })
    })
  } catch (err) {
    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: "FAILED" },
    })
    if (err instanceof CapacityError) {
      return { ok: false, paymentId, reason: "capacity_exceeded" }
    }
    return {
      ok: false,
      paymentId,
      reason: "error",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  return { ok: true, paymentId, ticketCount, ticketNumbers }
}