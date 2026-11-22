import "server-only"
import type { Context } from "grammy"
import prisma from "@/lib/prisma"

export interface BotUser {
  id: string
  name: string
  telegramId: string
  phoneNumber: string | null
  role: "USER" | "ADMIN"
  createdAt: Date
}

export async function findBotUser(ctx: Context): Promise<BotUser | null> {
  if (!ctx.from) return null
  const user = await prisma.user.findUnique({
    where: { telegramId: String(ctx.from.id) },
    select: {
      id: true,
      name: true,
      telegramId: true,
      phoneNumber: true,
      role: true,
      createdAt: true,
    },
  })
  return user
}