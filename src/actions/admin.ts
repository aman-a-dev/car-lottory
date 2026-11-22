// "use server";

// import { revalidatePath } from "next/cache";
// import prisma from "@/lib/prisma";

// export function createLottory() {
//   return
// }
// export function getLottoryAdmin() {
//   return
// }
// export function updateLottoryAdmin() {
//   return
// }
// export function deleteLottoryAdmin() {
//   return
// }
// export function getUsers() {
//   return
// }
// export function getAudit() {
//   return
// }
// export function getPayments() {
//   return
// }
// export function sendMsgForAllUsers() {
//   return
// }


"use server"

import { revalidatePath } from "next/cache"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/get-user"
import {
  createLotterySchema,
  updateLotterySchema,
  deleteLotterySchema,
  sendMsgForAllUsersSchema,
  type SendMsgForAllUsersInput,
} from "@/lib/schema"
import {
  MAX_IMAGES_PER_LOTTERY,
  uploadLotteryImages,
  deleteAllLotteryImages,
  deleteBlobByUrl,
} from "@/lib/upload"
import { bot } from "@/lib/bot/bot"
import type { Prisma } from "@/generated/prisma/client"

// ---------- Serialization ----------

function toNum(d: { toString(): string } | number | string): number {
  return typeof d === "number" ? d : Number(d.toString())
}

function formStr(fd: FormData, key: string): string | null {
  const v = fd.get(key)
  return typeof v === "string" && v.length > 0 ? v : null
}

function formFiles(fd: FormData, key: string): File[] {
  return fd.getAll(key).filter((v): v is File => v instanceof File && v.size > 0)
}

function formStrings(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v.length > 0)
}

// ---------- Create ----------

export async function createLottery(formData: FormData) {
  const admin = await requireAdmin()

  const totalRaw = formStr(formData, "totalTickets")
  const parsed = createLotterySchema.parse({
    name: formStr(formData, "name") ?? "",
    description: formStr(formData, "description") ?? undefined,
    ticketPriceEtb: formStr(formData, "ticketPriceEtb") ?? "",
    totalTickets: totalRaw === null ? null : totalRaw,
    drawDate: formStr(formData, "drawDate") ?? "",
    status: formStr(formData, "status") ?? "ACTIVE",
  })

  const imageFiles = formFiles(formData, "images")
  if (imageFiles.length > MAX_IMAGES_PER_LOTTERY) {
    throw new Error(`Up to ${MAX_IMAGES_PER_LOTTERY} images allowed`)
  }

  // Pre-generate the id so blob pathing and DB insert share the same key.
  const lotteryId = crypto.randomUUID()
  let uploaded: Awaited<ReturnType<typeof uploadLotteryImages>> = []

  try {
    uploaded = await uploadLotteryImages(lotteryId, imageFiles)

    const lottery = await prisma.$transaction(async (tx) => {
      const row = await tx.lottery.create({
        data: {
          id: lotteryId,
          name: parsed.name,
          description: parsed.description ?? null,
          ticketPriceEtb: parsed.ticketPriceEtb,
          totalTickets: parsed.totalTickets ?? null,
          drawDate: parsed.drawDate,
          status: parsed.status,
          createdByAdminId: admin.id,
          images: {
            create: uploaded.map((u) => ({ url: u.url, isCover: u.isCover })),
          },
        },
        include: { images: true },
      })

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "lottery.create",
          entityType: "Lottery",
          entityId: row.id,
          metadata: { name: row.name, imageCount: uploaded.length },
        },
      })
      return row
    })

    revalidatePath("/admin/lottery")
    revalidatePath("/lottery")

    return {
      id: lottery.id,
      name: lottery.name,
      description: lottery.description,
      ticketPriceEtb: toNum(lottery.ticketPriceEtb),
      totalTickets: lottery.totalTickets,
      drawDate: lottery.drawDate,
      status: lottery.status,
      images: lottery.images.map((i) => ({ id: i.id, url: i.url, isCover: i.isCover })),
    }
  } catch (err) {
    // Roll back blobs if the DB write failed.
    await deleteAllLotteryImages(lotteryId).catch(() => undefined)
    throw err
  }
}

// ---------- Update ----------

export async function updateLottery(formData: FormData) {
  const admin = await requireAdmin()

  const id = formStr(formData, "id")
  if (!id) throw new Error("Lottery id is required")

  const partial: Record<string, unknown> = { id }
  const name = formStr(formData, "name")
  if (name !== null) partial.name = name
  const description = formStr(formData, "description")
  if (description !== null) partial.description = description
  const price = formStr(formData, "ticketPriceEtb")
  if (price !== null) partial.ticketPriceEtb = price
  const total = formStr(formData, "totalTickets")
  if (total !== null) partial.totalTickets = total === "" ? null : total
  const drawDate = formStr(formData, "drawDate")
  if (drawDate !== null) partial.drawDate = drawDate
  const status = formStr(formData, "status")
  if (status !== null) partial.status = status

  const parsed = updateLotterySchema.parse(partial)
  const { id: lotteryId, ...scalarData } = parsed

  const existing = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { images: true },
  })
  if (!existing) throw new Error("Lottery not found")

  // Diff images: everything not in `keepImageIds` is deleted.
  const keepIds = new Set(formStrings(formData, "keepImageIds"))
  const toDelete = existing.images.filter((img) => !keepIds.has(img.id))
  const newFiles = formFiles(formData, "newImages")

  const remainingCount = existing.images.length - toDelete.length + newFiles.length
  if (remainingCount > MAX_IMAGES_PER_LOTTERY) {
    throw new Error(`Up to ${MAX_IMAGES_PER_LOTTERY} images allowed`)
  }

  let uploaded: Awaited<ReturnType<typeof uploadLotteryImages>> = []
  try {
    uploaded = await uploadLotteryImages(lotteryId, newFiles)

    await prisma.$transaction(async (tx) => {
      await tx.lottery.update({
        where: { id: lotteryId },
        data: {
          ...scalarData,
          description:
            scalarData.description === undefined
              ? undefined
              : (scalarData.description ?? null),
          totalTickets:
            scalarData.totalTickets === undefined ? undefined : scalarData.totalTickets,
        },
      })

      if (toDelete.length > 0) {
        await tx.lotteryImage.deleteMany({
          where: { id: { in: toDelete.map((i) => i.id) } },
        })
      }
      if (uploaded.length > 0) {
        await tx.lotteryImage.createMany({
          data: uploaded.map((u) => ({
            lotteryId,
            url: u.url,
            isCover: u.isCover && !existing.images.some((i) => i.isCover && keepIds.has(i.id)),
          })),
        })
      }

      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "lottery.update",
          entityType: "Lottery",
          entityId: lotteryId,
          metadata: {
            changed: Object.keys(scalarData),
            imagesRemoved: toDelete.length,
            imagesAdded: uploaded.length,
          },
        },
      })
    })
  } catch (err) {
    // Roll back blobs if the DB write failed.
    if (uploaded.length > 0) {
      await Promise.all(uploaded.map((u) => deleteBlobByUrl(u.url).catch(() => undefined)))
    }
    throw err
  }

  // Delete removed blobs after the DB tx succeeds.
  await Promise.all(toDelete.map((i) => deleteBlobByUrl(i.url).catch(() => undefined)))

  revalidatePath("/admin/lottery")
  revalidatePath("/lottery")
  return { id: lotteryId }
}

// ---------- Delete ----------

export async function deleteLottery(id: string) {
  const admin = await requireAdmin()
  const { id: validId } = deleteLotterySchema.parse({ id })

  const existing = await prisma.lottery.findUnique({
    where: { id: validId },
    select: { id: true, name: true, _count: { select: { tickets: true } } },
  })
  if (!existing) throw new Error("Lottery not found")

  await prisma.$transaction(async (tx) => {
    await tx.lottery.delete({ where: { id: validId } })
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "lottery.delete",
        entityType: "Lottery",
        entityId: validId,
        metadata: { name: existing.name, tickets: existing._count.tickets },
      },
    })
  })

  await deleteAllLotteryImages(validId).catch(() => undefined)

  revalidatePath("/admin/lottery")
  revalidatePath("/lottery")
  return { id: validId }
}

// ---------- Reads (admin) ----------

export async function getLotteryAdmin(opts: { take?: number; skip?: number } = {}) {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100)
  const skip = Math.max(opts.skip ?? 0, 0)

  const [rows, total] = await Promise.all([
    prisma.lottery.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        images: { orderBy: { isCover: "desc" } },
        _count: { select: { tickets: true, payments: true } },
        draw: true,
      },
    }),
    prisma.lottery.count(),
  ])

  return {
    total,
    take,
    skip,
    items: rows.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      ticketPriceEtb: toNum(l.ticketPriceEtb),
      totalTickets: l.totalTickets,
      drawDate: l.drawDate,
      status: l.status,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      images: l.images.map((i) => ({ id: i.id, url: i.url, isCover: i.isCover })),
      ticketsSold: l._count.tickets,
      paymentsCount: l._count.payments,
      hasDraw: l.draw !== null,
    })),
  }
}

export async function getUsers(opts: { take?: number; skip?: number } = {}) {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100)
  const skip = Math.max(opts.skip ?? 0, 0)

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        name: true,
        telegramId: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
        _count: { select: { tickets: true, payments: true } },
      },
    }),
    prisma.user.count(),
  ])

  return {
    total,
    take,
    skip,
    items: rows.map((u) => ({
      id: u.id,
      name: u.name,
      telegramId: u.telegramId,
      phoneNumber: u.phoneNumber,
      role: u.role,
      createdAt: u.createdAt,
      ticketsCount: u._count.tickets,
      paymentsCount: u._count.payments,
    })),
  }
}

export async function getPayments(opts: { take?: number; skip?: number } = {}) {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100)
  const skip = Math.max(opts.skip ?? 0, 0)

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, telegramId: true } },
        lottery: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.payment.count(),
  ])

  return {
    total,
    take,
    skip,
    items: rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      lotteryId: p.lotteryId,
      receiptText: p.receiptText,
      amountEtb: toNum(p.amountEtb),
      status: p.status,
      verifiedAt: p.verifiedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      lottery: p.lottery,
      ticketsCount: p._count.tickets,
    })),
  }
}


export async function getAudit(
  opts: { take?: number; skip?: number; entityType?: string } = {},
) {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100)
  const skip = Math.max(opts.skip ?? 0, 0)
  const where = opts.entityType ? { entityType: opts.entityType } : {}

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { admin: { select: { id: true, name: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])

  return { total, take, skip, items: rows }
}
// ---------- Broadcast ----------

export interface SendMsgResult {
  total: number
  sent: number
  failed: number
  errors: { userId: string; message: string }[]
}

/**
 * Sends `msg` to every user except those in `exceptionUserIds`.
 * Chunks of 25 with a short delay to respect Telegram's ~30 msg/s limit.
 */
export async function sendMsgForAllUsers(
  input: SendMsgForAllUsersInput,
): Promise<SendMsgResult> {
  const admin = await requireAdmin()
  const parsed = sendMsgForAllUsersSchema.parse(input)

  const users = await prisma.user.findMany({
    select: { id: true, telegramId: true },
  })

  const excluded = new Set(parsed.exceptionUserIds ?? [])
  const targets = users.filter((u) => !excluded.has(u.id))

  let sent = 0
  let failed = 0
  const errors: SendMsgResult["errors"] = []

  const CHUNK = 25
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK)
    await Promise.all(
      chunk.map(async (u) => {
        try {
          await bot.api.sendMessage(u.telegramId, parsed.msg)
          sent++
        } catch (err) {
          failed++
          errors.push({
            userId: u.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )
    if (i + CHUNK < targets.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      action: "message.broadcast",
      entityType: "User",
      entityId: "all",
      metadata: {
        total: targets.length,
        sent,
        failed,
        exceptionCount: excluded.size,
      },
    },
  })
  return { total: targets.length, sent, failed, errors }
}

export interface UserDetailTicket {
  id: string
  ticketNumber: string
  status: "VALID" | "WINNER" | "VOID"
  purchasedAt: Date
  lottery: {
    id: string
    name: string
    drawDate: Date
    status: "ACTIVE" | "CLOSED" | "DRAWN"
    ticketPriceEtb: number
    images: { id: string; url: string; isCover: boolean }[]
  }
  payment: {
    id: string
    amountEtb: number
    status: "PENDING" | "SUCCESS" | "FAILED"
    verifiedAt: Date | null
  }
  winningDraw: { id: string; drawTimestamp: Date } | null
}

export interface UserDetail {
  id: string
  name: string
  telegramId: string
  phoneNumber: string | null
  role: "USER" | "ADMIN"
  createdAt: Date
  paymentsCount: number
  tickets: UserDetailTicket[]
}

/** Full user record + every ticket, for the admin drill-down dialog. */
export async function getUserDetail(userId: string): Promise<UserDetail> {
  await requireAdmin()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tickets: {
        orderBy: { purchasedAt: "desc" },
        include: {
          lottery: { include: { images: { orderBy: { isCover: "desc" } } } },
          payment: true,
          winningDraw: true,
        },
      },
      _count: { select: { payments: true } },
    },
  })

  if (!user) throw new Error("User not found")

  return {
    id: user.id,
    name: user.name,
    telegramId: user.telegramId,
    phoneNumber: user.phoneNumber,
    role: user.role,
    createdAt: user.createdAt,
    paymentsCount: user._count.payments,
    tickets: user.tickets.map((t) => ({
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
        images: t.lottery.images.map((i) => ({
          id: i.id,
          url: i.url,
          isCover: i.isCover,
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
    })),
  }
}

// Append to src/actions/admin.ts

export type AdminTicketStatus = "VALID" | "WINNER" | "VOID"

export interface AdminTicketItem {
  id: string
  ticketNumber: string
  status: AdminTicketStatus
  purchasedAt: Date
  updatedAt: Date
  user: { id: string; name: string; telegramId: string }
  lottery: {
    id: string
    name: string
    status: "ACTIVE" | "CLOSED" | "DRAWN"
    drawDate: Date
    ticketPriceEtb: number
  }
  payment: {
    id: string
    amountEtb: number
    status: "PENDING" | "SUCCESS" | "FAILED"
  }
  winningDraw: { id: string; drawTimestamp: Date } | null
}

export interface AdminTicketsResult {
  total: number
  take: number
  skip: number
  items: AdminTicketItem[]
}

export async function getTickets(
  opts: { take?: number; skip?: number; status?: AdminTicketStatus } = {},
): Promise<AdminTicketsResult> {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 200)
  const skip = Math.max(opts.skip ?? 0, 0)
  const where = opts.status ? { status: opts.status } : {}

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { purchasedAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, telegramId: true } },
        lottery: {
          select: {
            id: true,
            name: true,
            status: true,
            drawDate: true,
            ticketPriceEtb: true,
          },
        },
        payment: { select: { id: true, amountEtb: true, status: true } },
        winningDraw: { select: { id: true, drawTimestamp: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ])

  return {
    total,
    take,
    skip,
    items: rows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      purchasedAt: t.purchasedAt,
      updatedAt: t.updatedAt,
      user: t.user,
      lottery: {
        id: t.lottery.id,
        name: t.lottery.name,
        status: t.lottery.status,
        drawDate: t.lottery.drawDate,
        ticketPriceEtb: toNum(t.lottery.ticketPriceEtb),
      },
      payment: {
        id: t.payment.id,
        amountEtb: toNum(t.payment.amountEtb),
        status: t.payment.status,
      },
      winningDraw: t.winningDraw
        ? { id: t.winningDraw.id, drawTimestamp: t.winningDraw.drawTimestamp }
        : null,
    })),
  }
}

// Append to src/actions/admin.ts

export interface DashboardStats {
  users: { total: number; admins: number; newLast7Days: number }
  lotteries: {
    total: number
    active: number
    closed: number
    drawn: number
    upcomingDraws: number
  }
  tickets: {
    total: number
    valid: number
    winners: number
    void: number
    soldLast7Days: number
  }
  payments: {
    total: number
    success: number
    pending: number
    failed: number
    revenueEtb: number
    revenueLast7Days: number
  }
  topLotteries: {
    id: string
    name: string
    status: "ACTIVE" | "CLOSED" | "DRAWN"
    ticketsSold: number
    revenueEtb: number
  }[]
  recentAudit: {
    id: string
    action: string
    entityType: string
    entityId: string
    adminName: string | null
    createdAt: Date
  }[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    adminUsers,
    newUsersLast7,
    lotteryByStatus,
    upcomingDraws,
    ticketByStatus,
    ticketsLast7,
    paymentsByStatus,
    revenueLast7Agg,
    topLotteryRows,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.lottery.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lottery.count({
      where: { status: "ACTIVE", drawDate: { gt: now } },
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.ticket.count({ where: { purchasedAt: { gte: sevenDaysAgo } } }),
    prisma.payment.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountEtb: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS", createdAt: { gte: sevenDaysAgo } },
      _sum: { amountEtb: true },
    }),
    prisma.lottery.findMany({
      take: 5,
      orderBy: { tickets: { _count: "desc" } },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { tickets: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { admin: { select: { name: true } } },
    }),
  ])

  // Revenue for the top lotteries (one extra query, only for those 5 ids).
  const topIds = topLotteryRows.map((l) => l.id)
  const topRevenue =
    topIds.length === 0
      ? []
      : await prisma.payment.groupBy({
        by: ["lotteryId"],
        where: { lotteryId: { in: topIds }, status: "SUCCESS" },
        _sum: { amountEtb: true },
      })
  const revenueByLottery = new Map(
    topRevenue.map((r) => [r.lotteryId, toNum(r._sum.amountEtb ?? 0)] as const),
  )

  // Bucket the groupBy rows into lookup maps.
  const lotteryCounts = Object.fromEntries(
    lotteryByStatus.map((g) => [g.status, g._count._all]),
  ) as Partial<Record<"ACTIVE" | "CLOSED" | "DRAWN", number>>
  const ticketCounts = Object.fromEntries(
    ticketByStatus.map((g) => [g.status, g._count._all]),
  ) as Partial<Record<"VALID" | "WINNER" | "VOID", number>>
  const paymentCounts = Object.fromEntries(
    paymentsByStatus.map((g) => [g.status, g._count._all]),
  ) as Partial<Record<"PENDING" | "SUCCESS" | "FAILED", number>>
  const revenueByStatus = Object.fromEntries(
    paymentsByStatus.map((g) => [g.status, toNum(g._sum.amountEtb ?? 0)]),
  ) as Partial<Record<"PENDING" | "SUCCESS" | "FAILED", number>>

  return {
    users: {
      total: totalUsers,
      admins: adminUsers,
      newLast7Days: newUsersLast7,
    },
    lotteries: {
      total:
        (lotteryCounts.ACTIVE ?? 0) +
        (lotteryCounts.CLOSED ?? 0) +
        (lotteryCounts.DRAWN ?? 0),
      active: lotteryCounts.ACTIVE ?? 0,
      closed: lotteryCounts.CLOSED ?? 0,
      drawn: lotteryCounts.DRAWN ?? 0,
      upcomingDraws,
    },
    tickets: {
      total:
        (ticketCounts.VALID ?? 0) +
        (ticketCounts.WINNER ?? 0) +
        (ticketCounts.VOID ?? 0),
      valid: ticketCounts.VALID ?? 0,
      winners: ticketCounts.WINNER ?? 0,
      void: ticketCounts.VOID ?? 0,
      soldLast7Days: ticketsLast7,
    },
    payments: {
      total:
        (paymentCounts.SUCCESS ?? 0) +
        (paymentCounts.PENDING ?? 0) +
        (paymentCounts.FAILED ?? 0),
      success: paymentCounts.SUCCESS ?? 0,
      pending: paymentCounts.PENDING ?? 0,
      failed: paymentCounts.FAILED ?? 0,
      revenueEtb: revenueByStatus.SUCCESS ?? 0,
      revenueLast7Days: toNum(revenueLast7Agg._sum.amountEtb ?? 0),
    },
    topLotteries: topLotteryRows.map((l) => ({
      id: l.id,
      name: l.name,
      status: l.status,
      ticketsSold: l._count.tickets,
      revenueEtb: revenueByLottery.get(l.id) ?? 0,
    })),
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      adminName: a.admin?.name ?? null,
      createdAt: a.createdAt,
    })),
  }
}

// Replace getPayments with this version:

export type AdminPaymentStatus = "PENDING" | "SUCCESS" | "FAILED"

export interface AdminPaymentItem {
  id: string
  userId: string
  lotteryId: string
  receiptText: string
  amountEtb: number
  status: AdminPaymentStatus
  verifiedAt: Date | null
  providerRaw: unknown
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; telegramId: string }
  lottery: { id: string; name: string }
  ticketsCount: number
}

export interface AdminPaymentsResult {
  total: number
  take: number
  skip: number
  items: AdminPaymentItem[]
}

export async function getPayments(
  opts: { take?: number; skip?: number; status?: AdminPaymentStatus } = {},
): Promise<AdminPaymentsResult> {
  await requireAdmin()
  const take = Math.min(Math.max(opts.take ?? 50, 1), 100)
  const skip = Math.max(opts.skip ?? 0, 0)
  const where = opts.status ? { status: opts.status } : {}

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, name: true, telegramId: true } },
        lottery: { select: { id: true, name: true } },
        _count: { select: { tickets: true } },
      },
    }),
    prisma.payment.count({ where }),
  ])

  return {
    total,
    take,
    skip,
    items: rows.map((p) => ({
      id: p.id,
      userId: p.userId,
      lotteryId: p.lotteryId,
      receiptText: p.receiptText,
      amountEtb: toNum(p.amountEtb),
      status: p.status,
      verifiedAt: p.verifiedAt,
      providerRaw: p.providerRaw, // already returned by default — just expose it
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      lottery: p.lottery,
      ticketsCount: p._count.tickets,
    })),
  }
}

// ---------- Payment detail ----------

export interface PaymentDetailTicket {
  id: string
  ticketNumber: string
  status: "VALID" | "WINNER" | "VOID"
  purchasedAt: Date
}

export interface PaymentDetail {
  id: string
  userId: string
  lotteryId: string
  receiptText: string
  amountEtb: number
  status: AdminPaymentStatus
  verifiedAt: Date | null
  providerRaw: unknown
  createdAt: Date
  updatedAt: Date
  user: { id: string; name: string; telegramId: string }
  lottery: {
    id: string
    name: string
    ticketPriceEtb: number
    drawDate: Date
  }
  tickets: PaymentDetailTicket[]
}

export async function getPaymentDetail(id: string): Promise<PaymentDetail> {
  await requireAdmin()

  const p = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, telegramId: true } },
      lottery: {
        select: { id: true, name: true, ticketPriceEtb: true, drawDate: true },
      },
      tickets: {
        orderBy: { ticketNumber: "asc" },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          purchasedAt: true,
        },
      },
    },
  })

  if (!p) throw new Error("Payment not found")

  return {
    id: p.id,
    userId: p.userId,
    lotteryId: p.lotteryId,
    receiptText: p.receiptText,
    amountEtb: toNum(p.amountEtb),
    status: p.status,
    verifiedAt: p.verifiedAt,
    providerRaw: p.providerRaw,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    user: p.user,
    lottery: {
      id: p.lottery.id,
      name: p.lottery.name,
      ticketPriceEtb: toNum(p.lottery.ticketPriceEtb),
      drawDate: p.lottery.drawDate,
    },
    tickets: p.tickets,
  }
}