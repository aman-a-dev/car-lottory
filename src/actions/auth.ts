"use server"

import prisma from "@/lib/prisma"
import { setSessionCookie, clearSessionCookie } from "@/lib/session"
import { displayName, validateTelegramInitData } from "@/lib/telegram"

export type TelegramAuthResult =
  | { ok: true; userId: string; name: string; role: "USER" | "ADMIN" }
  | { ok: false; error: string }

export async function authenticateTelegram(
  initData: string,
): Promise<TelegramAuthResult> {
  const result = validateTelegramInitData(initData)
  if (!result.ok) return result

  const { user } = result

  const saved = await prisma.user.upsert({
    where: { telegramId: String(user.id) },
    update: { name: displayName(user) },
    create: {
      telegramId: String(user.id),
      name: displayName(user),
    },
    select: { id: true, name: true, role: true },
  })

  await setSessionCookie(saved.id)

  return { ok: true, userId: saved.id, name: saved.name, role: saved.role }
}

export async function logout() {
  await clearSessionCookie()
}