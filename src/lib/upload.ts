import "server-only"
import { put, del, list } from "@vercel/blob"
import { randomUUID } from "node:crypto"

export const MAX_IMAGES_PER_LOTTERY = 5
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // Vercel Blob per-file limit

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

function extensionFor(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "bin"
}

function lotteryPrefix(lotteryId: string): string {
  return `lotteries/${lotteryId}/`
}

export interface UploadedLotteryImage {
  url: string
  pathname: string
  isCover: boolean
}

// ---------- Uploads ----------

export async function uploadLotteryImage(
  lotteryId: string,
  file: File,
  isCover = false,
): Promise<UploadedLotteryImage> {
  if (!file.size) throw new Error("Empty file")
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit`)
  }

  const pathname = `${lotteryPrefix(lotteryId)}${randomUUID()}.${extensionFor(file.type)}`

  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type || "application/octet-stream",
    addRandomSuffix: false,
  })

  return { url: blob.url, pathname: blob.pathname, isCover }
}

export async function uploadLotteryImages(
  lotteryId: string,
  files: File[],
): Promise<UploadedLotteryImage[]> {
  if (files.length === 0) return []
  if (files.length > MAX_IMAGES_PER_LOTTERY) {
    throw new Error(`Up to ${MAX_IMAGES_PER_LOTTERY} images allowed per lottery`)
  }
  // First image becomes the cover by default; caller may override in the DB layer.
  return Promise.all(files.map((f, i) => uploadLotteryImage(lotteryId, f, i === 0)))
}

// ---------- Deletes ----------

export async function deleteBlobByUrl(url: string): Promise<void> {
  await del(url)
}

/** Best-effort: deletes every blob under `lotteries/<lotteryId>/`. */
export async function deleteAllLotteryImages(lotteryId: string): Promise<void> {
  const prefix = lotteryPrefix(lotteryId)
  let cursor: string | undefined
  do {
    const result = await list({ prefix, cursor, limit: 100 })
    const urls = result.blobs.map((b) => b.url)
    if (urls.length > 0) await del(urls)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)
}

// ---------- List ----------

export async function listLotteryImages(lotteryId: string) {
  const result = await list({ prefix: lotteryPrefix(lotteryId), limit: 100 })
  return result.blobs
}