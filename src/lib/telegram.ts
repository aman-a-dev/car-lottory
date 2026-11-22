import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAX_AGE = Number(process.env.TELEGRAM_AUTH_MAX_AGE ?? 86400);

export const telegramUserSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  photo_url: z.string().url().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

type ValidationResult =
  | { ok: true; user: TelegramUser; authDate: number }
  | { ok: false; error: string };

export function validateTelegramInitData(initDataRaw: string): ValidationResult {
  if (!BOT_TOKEN) return { ok: false, error: "BOT_TOKEN not configured" };
  if (!initDataRaw) return { ok: false, error: "Missing initData" };

  const params = new URLSearchParams(initDataRaw);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Missing hash" };

  // Build data-check-string from every field except `hash`
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // Telegram signature: HMAC_SHA256(HMAC_SHA256("WebAppData", bot_token), data_check_string)
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest();

  // timing-safe compare
  const provided = Buffer.from(hash, "hex");
  if (provided.length !== computed.length || !timingSafeEqual(provided, computed)) {
    return { ok: false, error: "Invalid signature" };
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > MAX_AGE) {
    return { ok: false, error: "initData expired" };
  }

  const rawUser = params.get("user");
  if (!rawUser) return { ok: false, error: "Missing user" };

  const parsed = telegramUserSchema.safeParse(JSON.parse(rawUser));
  if (!parsed.success) return { ok: false, error: "Invalid user payload" };

  return { ok: true, user: parsed.data, authDate };
}

/** Build the `name` field for your User model from Telegram names. */
export function displayName(u: TelegramUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
}