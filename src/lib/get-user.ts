import "server-only"
import { cache } from "react"
import prisma from "@/lib/prisma"
import { readSessionUserId } from "@/lib/session"

/**
 * Current user resolved from the signed `tg_user` cookie.
 * Memoized per request.
 */
export const getUser = cache(async () => {
  const userId = await readSessionUserId()
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId } })
})

export const getUserById = cache(async (id: string) =>
  prisma.user.findUnique({ where: { id } }),
)

export async function requireUser() {
  const user = await getUser()
  if (!user) throw new Error("Unauthorized")
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== "ADMIN") throw new Error("Forbidden")
  return user
}