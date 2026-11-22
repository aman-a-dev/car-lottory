"use client"

import { useRef, useState, useTransition } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  IconMinus,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconX,
} from "@tabler/icons-react"

import { submitPayment, submitPaymentImage } from "@/actions/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatEtb } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

export interface CheckoutLottery {
  id: string
  name: string
  ticketPriceEtb: number
  ticketsRemaining: number | null
}

interface CheckoutProps {
  lottery: CheckoutLottery
  onSuccess?: () => void
}

const MAX_IMAGES = 5

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(",")[1] ?? "")
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function Checkout({ lottery, onSuccess }: CheckoutProps) {
  const [tab, setTab] = useState<"text" | "image">("text")
  const [receiptText, setReceiptText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [tickets, setTickets] = useState(1)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const amountEtb = tickets * lottery.ticketPriceEtb
  const maxTickets = lottery.ticketsRemaining ?? Number.POSITIVE_INFINITY

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming).filter((f) => f.type.startsWith("image/"))
    if (files.length + arr.length > MAX_IMAGES) {
      toast.add({ title: `Up to ${MAX_IMAGES} images allowed`, type: "error" })
      return
    }
    setFiles((prev) => [...prev, ...arr])
  }

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = () => {
    if (tab === "text" && receiptText.trim().length === 0) {
      toast.add({ title: "Enter the receipt URL or reference number", type: "error" })
      return
    }
    if (tab === "image" && files.length === 0) {
      toast.add({ title: "Upload at least one receipt image", type: "error" })
      return
    }
    if (tickets > maxTickets) {
      toast.add({ title: `Only ${maxTickets} ticket(s) remaining`, type: "error" })
      return
    }

    startTransition(async () => {
      try {
        const result =
          tab === "text"
            ? await submitPayment({
              lotteryId: lottery.id,
              receiptText: receiptText.trim(),
              amountEtb,
            })
            : await submitPaymentImage({
              lotteryId: lottery.id,
              amountEtb,
              images: await Promise.all(files.map(fileToBase64)),
            })

        if (result.ok) {
          toast.add({
            title: `Success! ${result.ticketCount} ticket(s) issued.`,
            type: "success",
          })
          setReceiptText("")
          setFiles([])
          setTickets(1)
          onSuccess?.()
          return
        }

        switch (result.reason) {
          case "pending":
            toast.add({
              title: "Verification in progress",
              description: "We'll confirm your tickets shortly.",
              type: "info",
            })
            break
          case "amount_too_low":
            toast.add({
              title: "Amount is less than the ticket price.",
              type: "error",
            })
            break
          case "capacity_exceeded":
            toast.add({
              title: "Not enough tickets left for that quantity.",
              type: "error",
            })
            break
          case "verification_failed":
            toast.add({
              title: "Receipt could not be verified.",
              description: result.detail,
              type: "error",
            })
            break
          default:
            toast.add({
              title: "Something went wrong.",
              description: result.detail,
              type: "error",
            })
        }
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Something went wrong",
          type: "error",
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Method tabs */}
      <div className="inline-flex rounded-lg border bg-muted/50 p-1">
        <button
          type="button"
          onClick={() => setTab("text")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${tab === "text"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
            }`}
        >
          <IconReceipt className="size-4" />
          Receipt
        </button>
        <button
          type="button"
          onClick={() => setTab("image")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${tab === "image"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground"
            }`}
        >
          <IconPhoto className="size-4" />
          Screenshot
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "text" ? (
            <Textarea
              placeholder="Paste the Telebirr / bank receipt URL or reference number"
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              rows={4}
              disabled={isPending}
            />
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending || files.length >= MAX_IMAGES}
              >
                <IconPhoto className="size-4" />
                {files.length === 0 ? "Upload screenshot(s)" : "Add more"}
              </Button>
              {files.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  <AnimatePresence initial={false}>
                    {files.map((file, i) => (
                      <motion.div
                        key={`${file.name}-${i}`}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="size-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 shadow-sm"
                          aria-label="Remove"
                        >
                          <IconX className="size-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Ticket count */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Number of tickets</label>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setTickets((n) => Math.max(1, n - 1))}
              disabled={isPending || tickets <= 1}
            >
              <IconMinus className="size-4" />
            </Button>
            <Input
              type="number"
              min={1}
              value={tickets}
              onChange={(e) =>
                setTickets(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
              className="w-16 text-center"
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setTickets((n) => Math.min(maxTickets, n + 1))}
              disabled={isPending || tickets >= maxTickets}
            >
              <IconPlus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{formatEtb(amountEtb)}</div>
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full"
        size="lg"
      >
        {isPending ? (
          <>
            <Spinner />
            Verifying…
          </>
        ) : (
          "Verify & Buy"
        )}
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        We verify your receipt with the issuing bank automatically. If
        verification is slow, we&apos;ll confirm within a few minutes.
      </p>
    </div>
  )
}