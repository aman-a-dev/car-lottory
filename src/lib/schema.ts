// import * as z from "zod"


// const createLottorySchema = z.object({
//   name: z.string().max(50),
//   description: z.string().max(300),
//   ticketPriceEtb: z.number(),
//   totalTickets: z.number().optional(),

//   drawDate: z.date(),
//   status: z.string()
// })
// const updateLottorySchema = z.object({
//   name: z.string().max(50).optional(),
//   description: z.string().max(300).optional(),
//   ticketPriceEtb: z.number().optional(),
//   totalTickets: z.number().optional(),

//   drawDate: z.date().optional(),
//   status: z.string().optional()
// })

// const sendMsgForAllUsersSchema = z.object({
//   msg: z.string(),
//   exceptionUserIds: z.uuid().optional()
// })


import * as z from "zod"

// ---------- Enums (mirror Prisma) ----------

export const userRoleEnum = z.enum(["USER", "ADMIN"])
export const lotteryStatusEnum = z.enum(["ACTIVE", "CLOSED", "DRAWN"])
export const ticketStatusEnum = z.enum(["VALID", "WINNER", "VOID"])
export const paymentStatusEnum = z.enum(["PENDING", "SUCCESS", "FAILED"])

// ---------- Amounts (Decimal(10,2)) ----------

/**
 * Coerces to a finite number and keeps it inside `Decimal(10, 2)` bounds.
 * Rounding to 2 dp is delegated to Postgres/Prisma — we only sanity-check here.
 */
const etbAmount = z.coerce
  .number()
  .finite()
  .positive("Amount must be positive")
  .max(99_999_999.99, "Amount exceeds Decimal(10,2) limit")

// ---------- Lottery ----------

export const createLotterySchema = z.object({
  name: z.string().trim().min(1).max(50),
  description: z.string().trim().max(300).optional(),
  ticketPriceEtb: etbAmount,
  totalTickets: z.coerce.number().int().positive().nullable().optional(),
  drawDate: z.coerce.date(),
  status: lotteryStatusEnum.default("ACTIVE"),
})

export const updateLotterySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(50).optional(),
  description: z.string().trim().max(300).optional(),
  ticketPriceEtb: etbAmount.optional(),
  totalTickets: z.coerce.number().int().positive().nullable().optional(),
  drawDate: z.coerce.date().optional(),
  status: lotteryStatusEnum.optional(),
})

export const deleteLotterySchema = z.object({
  id: z.uuid(),
})

// ---------- Payments ----------

export const submitPaymentSchema = z.object({
  lotteryId: z.uuid(),
  /** Telebirr/bank receipt URL, or a telebirr reference number. */
  receiptText: z.string().trim().min(1).max(2000),
  amountEtb: etbAmount,
})
export const submitPaymentImageSchema = z.object({
  lotteryId: z.uuid(),
  amountEtb: etbAmount,
  images: z.array(z.string().min(1)).min(1).max(5),
})
// ---------- Broadcast ----------

export const sendMsgForAllUsersSchema = z.object({
  msg: z.string().trim().min(1).max(4096),
  exceptionUserIds: z.array(z.uuid()).optional(),
})

// ---------- Pagination ----------

export const paginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
})



// ---------- Types ----------

export type CreateLotteryInput = z.infer<typeof createLotterySchema>
export type UpdateLotteryInput = z.infer<typeof updateLotterySchema>
export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>
export type SendMsgForAllUsersInput = z.infer<typeof sendMsgForAllUsersSchema>
export type Pagination = z.infer<typeof paginationSchema>
