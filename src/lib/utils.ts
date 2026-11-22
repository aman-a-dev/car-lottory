export { cn } from "cn"

const etbFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ETB",
  currencyDisplay: "code", // renders "ETB 1,000.00" instead of the symbol
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats an amount as ETB. Accepts numbers, numeric strings, or anything
 * with `toString()` (e.g. Prisma's `Decimal`).
 */
export function formatEtb(amount: number | string | { toString(): string }): string {
  const n = typeof amount === "number" ? amount : Number(amount.toString())
  if (!Number.isFinite(n)) return "ETB 0.00"
  return etbFormatter.format(n)
}