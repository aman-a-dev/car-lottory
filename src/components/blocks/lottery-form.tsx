"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  IconPhoto,
  IconPlus,
  IconX,
} from "@tabler/icons-react"

import { createLottery, updateLottery } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"

// ---------- Types ----------

export interface LotteryFormInitial {
  id: string
  name: string
  description: string | null
  ticketPriceEtb: number
  totalTickets: number | null
  drawDate: Date
  status: "ACTIVE" | "CLOSED" | "DRAWN"
  images: { id: string; url: string; isCover: boolean }[]
}

interface LotteryFormDialogProps {
  mode: "create" | "update"
  initial?: LotteryFormInitial
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

// ---------- Helpers ----------

const MAX_IMAGES = 5

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function FilePreview({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={file.name}
        className="size-full object-cover"
        draggable={false}
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 shadow-sm"
        aria-label="Remove"
      >
        <IconX className="size-3" />
      </button>
    </div>
  )
}

function ImageTile({
  url,
  onRemove,
  badge,
}: {
  url: string
  onRemove: () => void
  badge?: string
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        className="size-full object-cover"
        draggable={false}
      />
      {badge && (
        <span className="absolute left-1 top-1 rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
          {badge}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 shadow-sm"
        aria-label="Remove"
      >
        <IconX className="size-3" />
      </button>
    </div>
  )
}

// ---------- Component ----------

export function LotteryFormDialog({
  mode,
  initial,
  open,
  onOpenChange,
  onSuccess,
}: LotteryFormDialogProps) {
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [ticketPriceEtb, setTicketPriceEtb] = useState("")
  const [totalTickets, setTotalTickets] = useState("")
  const [drawDate, setDrawDate] = useState("")
  const [status, setStatus] = useState<"ACTIVE" | "CLOSED" | "DRAWN">("ACTIVE")
  const [existingImages, setExistingImages] = useState<
    { id: string; url: string; isCover: boolean }[]
  >([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset on open transition only (don't clobber edits if parent re-renders).
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (mode === "create") {
        setName("")
        setDescription("")
        setTicketPriceEtb("")
        setTotalTickets("")
        setDrawDate("")
        setStatus("ACTIVE")
        setExistingImages([])
        setNewFiles([])
      } else if (initial) {
        setName(initial.name)
        setDescription(initial.description ?? "")
        setTicketPriceEtb(String(initial.ticketPriceEtb))
        setTotalTickets(
          initial.totalTickets === null ? "" : String(initial.totalTickets),
        )
        setDrawDate(toDateTimeLocal(initial.drawDate))
        setStatus(initial.status)
        setExistingImages(initial.images)
        setNewFiles([])
      }
    }
    prevOpenRef.current = open
  }, [open, mode, initial])

  const totalImages = existingImages.length + newFiles.length

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const arr = Array.from(incoming).filter((f) => f.type.startsWith("image/"))
    if (totalImages + arr.length > MAX_IMAGES) {
      toast.add({
        title: `Up to ${MAX_IMAGES} images allowed`,
        type: "error",
      })
      return
    }
    setNewFiles((prev) => [...prev, ...arr])
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.add({ title: "Name is required", type: "error" })
      return
    }
    if (!ticketPriceEtb.trim()) {
      toast.add({ title: "Ticket price is required", type: "error" })
      return
    }
    if (!drawDate) {
      toast.add({ title: "Draw date is required", type: "error" })
      return
    }

    const formData = new FormData()
    formData.set("name", name.trim())
    formData.set("description", description.trim())
    formData.set("ticketPriceEtb", ticketPriceEtb.trim())
    formData.set("totalTickets", totalTickets.trim()) // empty string = null
    formData.set("drawDate", drawDate)
    formData.set("status", status)

    if (mode === "create") {
      newFiles.forEach((f) => formData.append("images", f))
    } else if (initial) {
      formData.set("id", initial.id)
      existingImages.forEach((img) => formData.append("keepImageIds", img.id))
      newFiles.forEach((f) => formData.append("newImages", f))
    }

    startTransition(async () => {
      try {
        if (mode === "create") {
          await createLottery(formData)
        } else {
          await updateLottery(formData)
        }
        toast.add({
          title: mode === "create" ? "Lottery created" : "Lottery updated",
          type: "success",
        })
        onOpenChange(false)
        onSuccess?.()
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Something went wrong",
          type: "error",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create lottery" : "Edit lottery"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new lottery users can buy tickets for."
              : "Update lottery details and images."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="lottery-name">
              Name
            </label>
            <Input
              id="lottery-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="Weekly cash draw"
              disabled={isPending}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="lottery-description"
            >
              Description
            </label>
            <Textarea
              id="lottery-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Optional details about the prize and rules…"
              disabled={isPending}
            />
          </div>

          {/* Price + Total tickets */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="lottery-price"
              >
                Ticket price (ETB)
              </label>
              <Input
                id="lottery-price"
                type="number"
                min="0.01"
                step="0.01"
                value={ticketPriceEtb}
                onChange={(e) => setTicketPriceEtb(e.target.value)}
                placeholder="100.00"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="lottery-total"
              >
                Total tickets
              </label>
              <Input
                id="lottery-total"
                type="number"
                min="1"
                step="1"
                value={totalTickets}
                onChange={(e) => setTotalTickets(e.target.value)}
                placeholder="Leave blank for unlimited"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Draw date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="lottery-draw"
              >
                Draw date
              </label>
              <Input
                id="lottery-draw"
                type="datetime-local"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="lottery-status"
              >
                Status
              </label>
              <select
                id="lottery-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as typeof status)
                }
                disabled={isPending}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
                <option value="DRAWN">Drawn</option>
              </select>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Images ({totalImages}/{MAX_IMAGES})
              </label>
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
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending || totalImages >= MAX_IMAGES}
              >
                <IconPlus className="size-4" />
                Add
              </Button>
            </div>

            {totalImages === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                <IconPhoto className="size-5" />
                No images yet
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {existingImages.map((img) => (
                  <ImageTile
                    key={img.id}
                    url={img.url}
                    badge={img.isCover ? "Cover" : undefined}
                    onRemove={() =>
                      setExistingImages((prev) =>
                        prev.filter((i) => i.id !== img.id),
                      )
                    }
                  />
                ))}
                {newFiles.map((file, i) => (
                  <FilePreview
                    key={`${file.name}-${i}`}
                    file={file}
                    onRemove={() =>
                      setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}