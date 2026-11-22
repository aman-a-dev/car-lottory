import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SECRET = process.env.AUTH_SECRET ?? process.env.BOT_TOKEN;
if (!SECRET) throw new Error("Missing AUTH_SECRET (or BOT_TOKEN)");

const COOKIE_NAME = "tg_user";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(value: string): string {
  const sig = createHmac("sha256", SECRET!).update(value).digest("hex");
  return `${value}.${sig}`;
}

function unsign(token: string): string | null {
  const idx = token.lastIndexOf(".");
  if (idx === -1) return null;
  const value = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = createHmac("sha256", SECRET!).update(value).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Returns the DB user id if the cookie is present and its signature is valid. */
export async function readSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  return raw ? unsign(raw) : null;
}