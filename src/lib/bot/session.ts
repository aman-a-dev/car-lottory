import "server-only"

export interface PendingPurchase {
  userId: string
  lotteryId: string
  expectedAmountEtb: number
  createdAt: number
  expiresAt: number
}

const TTL_MS = 15 * 60 * 1000 // 15 minutes
const store = new Map<string, PendingPurchase>()

/**
 * NOTE: In-memory only — assumes a single long-lived Node process.
 * On Vercel serverless a cold start clears this map; a user mid-purchase
 * will be asked to re-open the lottery. Move to a Prisma-backed table
 * if/when that becomes a real problem.
 */
export function startPendingPurchase(
  telegramId: string,
  data: { userId: string; lotteryId: string; expectedAmountEtb: number },
): void {
  const now = Date.now()
  store.set(telegramId, {
    ...data,
    createdAt: now,
    expiresAt: now + TTL_MS,
  })
}

export function peekPendingPurchase(telegramId: string): PendingPurchase | null {
  const entry = store.get(telegramId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(telegramId)
    return null
  }
  return entry
}

export function clearPendingPurchase(telegramId: string): void {
  store.delete(telegramId)
}