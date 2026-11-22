"use client"

import {
  Component,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconTicket,
  IconTrash,
} from "@tabler/icons-react"

import { deleteLottery } from "@/actions/admin"
import { LotteryFormDialog } from "@/components/blocks/lottery-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { toast } from "@/components/ui/toast"
import { formatEtb } from "@/lib/utils"

// ---------- Types ----------

export interface AdminLotteryItem {
  id: string
  name: string
  description: string | null
  ticketPriceEtb: number
  totalTickets: number | null
  drawDate: Date
  status: "ACTIVE" | "CLOSED" | "DRAWN"
  createdAt: Date
  updatedAt: Date
  images: { id: string; url: string; isCover: boolean }[]
  ticketsSold: number
  paymentsCount: number
  hasDraw: boolean
}

export interface AdminLotteryResult {
  total: number
  take: number
  skip: number
  items: AdminLotteryItem[]
}

// ---------- Public entry ----------

export function LotteryAdmin({
  promise,
}: {
  promise: Promise<AdminLotteryResult>
}) {
  const router = useRouter()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (promiseRef.current !== promise) {
      promiseRef.current = promise
      setRetryKey((k) => k + 1)
      setIsRetrying(false)
    }
  }, [promise])

  const handleRetry = () => {
    setIsRetrying(true)
    router.refresh()
  }
  const handleRefresh = () => router.refresh()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Create, update, and remove lotteries.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus className="size-4" />
          Create lottery
        </Button>
      </div>

      <LotteryFormDialog
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleRefresh}
      />

      <ErrorBoundary
        key={retryKey}
        fallback={
          isRetrying ? (
            <ListSkeleton />
          ) : (
            <ListError onRetry={handleRetry} />
          )
        }
      >
        <Suspense fallback={<ListSkeleton />}>
          <Inner promise={promise} onChanged={handleRefresh} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

// ---------- Inner ----------

function Inner({
  promise,
  onChanged,
}: {
  promise: Promise<AdminLotteryResult>
  onChanged: () => void
}) {
  const result = use(promise)

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconTicket />
          </EmptyMedia>
          <EmptyTitle>No lotteries yet</EmptyTitle>
          <EmptyDescription>
            Create your first lottery to get started.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <motion.div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.04, delayChildren: 0.02 },
          },
        }}
      >
        {result.items.map((lottery) => (
          <motion.div
            key={lottery.id}
            variants={{
              hidden: { opacity: 0, y: 12 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AdminLotteryCard lottery={lottery} onChanged={onChanged} />
          </motion.div>
        ))}
      </motion.div>

      {result.total > result.items.length && (
        <p className="pt-2 text-center text-xs text-muted-foreground">
          Showing {result.items.length} of {result.total} lotteries
        </p>
      )}
    </>
  )
}

// ---------- Card ----------

function AdminLotteryCard({
  lottery,
  onChanged,
}: {
  lottery: AdminLotteryItem
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const cover =
    lottery.images.find((i) => i.isCover) ?? lottery.images[0]

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        {/* Cover */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={lottery.name}
              className="size-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <IconTicket className="size-8" />
            </div>
          )}

          <span
            className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shadow-sm ${lottery.status === "ACTIVE"
              ? "bg-emerald-600 text-white"
              : lottery.status === "CLOSED"
                ? "bg-zinc-700 text-white"
                : "bg-primary text-primary-foreground"
              }`}
          >
            {lottery.status}
          </span>

          {lottery.images.length > 1 && (
            <span className="absolute right-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
              {lottery.images.length} images
            </span>
          )}
        </div>

        {/* Body */}
        <div className="space-y-2.5 p-3">
          <div>
            <h3 className="line-clamp-1 text-sm font-semibold">
              {lottery.name}
            </h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {lottery.description ?? "No description"}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Price</dt>
              <dd className="font-medium">
                {formatEtb(lottery.ticketPriceEtb)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Sold</dt>
              <dd className="font-medium">
                {lottery.ticketsSold}
                {lottery.totalTickets === null
                  ? " / ∞"
                  : ` / ${lottery.totalTickets}`}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Payments</dt>
              <dd className="font-medium">{lottery.paymentsCount}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Draw</dt>
              <dd className="flex items-center gap-1 font-medium">
                <IconCalendarEvent className="size-3" />
                {new Date(lottery.drawDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setEditOpen(true)}
            >
              <IconEdit className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <IconTrash className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <LotteryFormDialog
        mode="update"
        initial={{
          id: lottery.id,
          name: lottery.name,
          description: lottery.description,
          ticketPriceEtb: lottery.ticketPriceEtb,
          totalTickets: lottery.totalTickets,
          drawDate: lottery.drawDate,
          status: lottery.status,
          images: lottery.images,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onChanged}
      />

      <DeleteDialog
        lottery={lottery}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onChanged}
      />
    </>
  )
}

// ---------- Delete dialog ----------

function DeleteDialog({
  lottery,
  open,
  onOpenChange,
  onDeleted,
}: {
  lottery: AdminLotteryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteLottery(lottery.id)
        toast.add({ title: "Lottery deleted", type: "success" })
        onOpenChange(false)
        onDeleted()
      } catch (err) {
        toast.add({
          title: err instanceof Error ? err.message : "Delete failed",
          type: "error",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete lottery?</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{lottery.name}</span> and its{" "}
            {lottery.ticketsSold} ticket
            {lottery.ticketsSold === 1 ? "" : "s"} will be permanently
            removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Spinner />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Loading ----------

function ListSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-2.5 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Error ----------

function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Couldn&apos;t load lotteries</h3>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching the list. Please try again.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <IconRefresh className="size-4" />
        Try again
      </Button>
    </div>
  )
}

// ---------- Error boundary ----------

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}