"use client"

import {
  Component,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { motion } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconRefresh,
  IconTicket,
  IconTrophy,
} from "@tabler/icons-react"

import type { AdminTicketStatus, AdminTicketsResult } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn, formatEtb } from "@/lib/utils"

// ---------- Status chips ----------

const TICKET_STATUS: Record<
  AdminTicketStatus,
  { label: string; className: string }
> = {
  VALID: { label: "Valid", className: "bg-primary/10 text-primary" },
  WINNER: {
    label: "Winner",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  VOID: { label: "Void", className: "bg-muted text-muted-foreground" },
}

const PAYMENT_STATUS = {
  SUCCESS: {
    label: "Paid",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  PENDING: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  FAILED: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
  },
} as const

const FILTERS: { value: AdminTicketStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "VALID", label: "Valid" },
  { value: "WINNER", label: "Winners" },
  { value: "VOID", label: "Void" },
]

// ---------- Public entry ----------

export function TicketAdmin({
  promise,
}: {
  promise: Promise<AdminTicketsResult>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const currentFilter = (searchParams.get("status") as AdminTicketStatus | null) ?? "ALL"

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

  const setFilter = (value: AdminTicketStatus | "ALL") => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "ALL") params.delete("status")
    else params.set("status", value)
    params.delete("page")
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = currentFilter === f.value
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <ErrorBoundary
        key={`${retryKey}-${currentFilter}`}
        fallback={
          isRetrying ? (
            <TicketTableSkeleton />
          ) : (
            <ListError onRetry={handleRetry} />
          )
        }
      >
        <Suspense fallback={<TicketTableSkeleton />}>
          <Inner promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

// ---------- Inner ----------

function Inner({ promise }: { promise: Promise<AdminTicketsResult> }) {
  const result = use(promise)

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconTicket />
          </EmptyMedia>
          <EmptyTitle>No tickets</EmptyTitle>
          <EmptyDescription>
            No tickets match the current filter.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Ticket #</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Lottery</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Purchased</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((t, i) => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(i * 0.02, 0.3),
                  ease: "easeOut",
                }}
                className="border-b transition-colors hover:bg-muted/40 last:border-b-0"
              >
                <TableCell className="font-mono text-xs tabular-nums">
                  {t.ticketNumber}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.user.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.user.telegramId}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="line-clamp-1 text-sm">
                      {t.lottery.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Draw{" "}
                      {new Date(t.lottery.drawDate).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric" },
                      )}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-right text-sm font-medium">
                  {formatEtb(t.payment.amountEtb)}
                </TableCell>

                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                      PAYMENT_STATUS[t.payment.status].className,
                    )}
                  >
                    {PAYMENT_STATUS[t.payment.status].label}
                  </span>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        TICKET_STATUS[t.status].className,
                      )}
                    >
                      {t.status === "WINNER" && (
                        <IconTrophy className="size-2.5" />
                      )}
                      {TICKET_STATUS[t.status].label}
                    </span>
                    {t.winningDraw && (
                      <span className="text-[10px] text-muted-foreground">
                        Won{" "}
                        {new Date(
                          t.winningDraw.drawTimestamp,
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {new Date(t.purchasedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.total > result.items.length && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Showing {result.items.length} of {result.total} tickets
        </p>
      )}
    </>
  )
}

// ---------- Loading ----------

function TicketTableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-4 border-b px-3 py-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-3 py-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
          <Skeleton className="h-3 w-20" />
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
        <h3 className="text-base font-semibold">Couldn&apos;t load tickets</h3>
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