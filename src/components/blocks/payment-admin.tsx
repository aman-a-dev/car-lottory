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
import { AnimatePresence, motion } from "motion/react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconRefresh,
  IconX,
} from "@tabler/icons-react"

import {
  getPaymentDetail,
  type AdminPaymentItem,
  type AdminPaymentStatus,
  type AdminPaymentsResult,
  type PaymentDetail,
} from "@/actions/admin"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { toast } from "@/components/ui/toast"
import { cn, formatEtb } from "@/lib/utils"

// ---------- Config ----------

const PAYMENT_STATUS: Record<
  AdminPaymentStatus,
  { label: string; className: string; icon: typeof IconCheck }
> = {
  SUCCESS: {
    label: "Success",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: IconCheck,
  },
  PENDING: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: IconClock,
  },
  FAILED: {
    label: "Failed",
    className: "bg-destructive/10 text-destructive",
    icon: IconX,
  },
}

const FILTERS: { value: AdminPaymentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUCCESS", label: "Success" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
]

// ---------- Public entry ----------

export function PaymentAdmin({
  promise,
}: {
  promise: Promise<AdminPaymentsResult>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const currentFilter =
    (searchParams.get("status") as AdminPaymentStatus | null) ?? "ALL"

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

  const setFilter = (value: AdminPaymentStatus | "ALL") => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "ALL") params.delete("status")
    else params.set("status", value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
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
          isRetrying ? <TableSkeleton /> : <ListError onRetry={handleRetry} />
        }
      >
        <Suspense fallback={<TableSkeleton />}>
          <Inner promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

// ---------- Inner ----------

function Inner({ promise }: { promise: Promise<AdminPaymentsResult> }) {
  const result = use(promise)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconClock />
          </EmptyMedia>
          <EmptyTitle>No payments</EmptyTitle>
          <EmptyDescription>
            No payments match the current filter.
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
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Lottery</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Tickets</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((payment, i) => (
              <motion.tr
                key={payment.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(i * 0.02, 0.3),
                  ease: "easeOut",
                }}
                onClick={() => setSelectedId(payment.id)}
                className="cursor-pointer border-b transition-colors hover:bg-muted/40 last:border-b-0"
              >
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(payment.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {payment.user.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {payment.user.telegramId}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <span className="line-clamp-1 text-sm">
                    {payment.lottery.name}
                  </span>
                </TableCell>

                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {formatEtb(payment.amountEtb)}
                </TableCell>

                <TableCell>
                  <StatusChip payment={payment} />
                </TableCell>

                <TableCell className="text-center text-sm tabular-nums">
                  {payment.ticketsCount}
                </TableCell>

                <TableCell>
                  <IconChevronDown className="size-4 -rotate-90 text-muted-foreground" />
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {result.total > result.items.length && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Showing {result.items.length} of {result.total} payments
        </p>
      )}

      <PaymentDetailDialog
        paymentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

// ---------- Status chip ----------

function StatusChip({ payment }: { payment: AdminPaymentItem }) {
  const cfg = PAYMENT_STATUS[payment.status]
  const Icon = cfg.icon

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          cfg.className,
        )}
      >
        <Icon className="size-2.5" />
        {cfg.label}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {payment.status === "SUCCESS" && payment.verifiedAt
          ? `Verified ${formatRelative(payment.verifiedAt)}`
          : formatRelative(payment.createdAt)}
      </span>
    </div>
  )
}

// ---------- Detail dialog ----------

function PaymentDetailDialog({
  paymentId,
  onClose,
}: {
  paymentId: string | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!paymentId) {
      setDetail(null)
      return
    }
    setIsLoading(true)
    getPaymentDetail(paymentId)
      .then(setDetail)
      .catch((err) => {
        toast.add({
          title: "Failed to load payment",
          description: err instanceof Error ? err.message : undefined,
          type: "error",
        })
        onClose()
      })
      .finally(() => setIsLoading(false))
  }, [paymentId, onClose])

  return (
    <Dialog open={paymentId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Payment
            {detail && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  PAYMENT_STATUS[detail.status].className,
                )}
              >
                {PAYMENT_STATUS[detail.status].label}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {paymentId ? `#${paymentId.slice(0, 12)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !detail ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : detail ? (
          <PaymentDetailBody detail={detail} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function PaymentDetailBody({ detail }: { detail: PaymentDetail }) {
  const source = getVerifiedSource(detail.providerRaw)

  return (
    <div className="space-y-4">
      {/* Amount + meta */}
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Amount
        </div>
        <div className="text-2xl font-semibold tabular-nums">
          {formatEtb(detail.amountEtb)}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>
            Created{" "}
            {new Date(detail.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {detail.verifiedAt && (
            <span>
              · Verified{" "}
              {new Date(detail.verifiedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {/* Key-value grid */}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted-foreground">User</dt>
        <dd>
          <div className="font-medium">{detail.user.name}</div>
          <div className="text-[11px] text-muted-foreground">
            Telegram {detail.user.telegramId}
          </div>
        </dd>

        <dt className="text-muted-foreground">Lottery</dt>
        <dd className="font-medium">{detail.lottery.name}</dd>

        <dt className="text-muted-foreground">Ticket price</dt>
        <dd className="tabular-nums">
          {formatEtb(detail.lottery.ticketPriceEtb)}
        </dd>

        {source && (
          <>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-mono text-[11px]">{source}</dd>
          </>
        )}
      </dl>

      {/* Receipt */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Receipt</span>
          <CopyButton value={detail.receiptText} />
        </div>
        <ReceiptView receipt={detail.receiptText} />
      </div>

      {/* Tickets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">
            Tickets issued ({detail.tickets.length})
          </span>
        </div>
        {detail.tickets.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            No tickets issued yet.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-md border">
            <ul className="divide-y text-xs">
              {detail.tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between px-2.5 py-1.5"
                >
                  <span className="font-mono tabular-nums">
                    #{t.ticketNumber}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      t.status === "WINNER"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : t.status === "VOID"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Provider raw */}
      {detail.providerRaw !== null && detail.providerRaw !== undefined && (
        <ProviderRawView raw={detail.providerRaw} />
      )}
    </div>
  )
}

// ---------- Receipt view ----------

function ReceiptView({ receipt }: { receipt: string }) {
  const isUrl = /^https?:\/\//i.test(receipt)
  const isImage = receipt.startsWith("img:")

  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-[11px]">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 break-all font-mono">
          {receipt}
        </div>
        {isUrl && (
          <a
            href={receipt}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Open receipt"
          >
            <IconExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      {isImage && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Image-based receipt (hashed)
        </p>
      )}
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.add({ title: "Copy failed", type: "error" })
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <IconCopy className="size-3" />
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ---------- Provider raw ----------

function ProviderRawView({ raw }: { raw: unknown }) {
  const [expanded, setExpanded] = useState(false)
  const summary = summarizeProvider(raw)

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>Verification result</span>
        <span className="flex items-center gap-1 text-[11px]">
          {summary.label}
          <IconChevronDown
            className={cn("size-3 transition-transform", expanded && "rotate-180")}
          />
        </span>
      </button>

      {summary.hint && (
        <p className="text-[11px] text-muted-foreground">{summary.hint}</p>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function summarizeProvider(raw: unknown): { label: string; hint: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { label: "—", hint: "" }
  }
  const r = raw as Record<string, unknown>
  const status = typeof r.status === "string" ? r.status : "unknown"

  switch (status) {
    case "verified": {
      const receipt = r.receipt
      const source =
        receipt && typeof receipt === "object" && !Array.isArray(receipt) &&
          typeof (receipt as Record<string, unknown>).source === "string"
          ? ((receipt as Record<string, unknown>).source as string)
          : null
      return {
        label: "Verified",
        hint: source ? `Receipt parsed from ${source}` : "",
      }
    }
    case "queued":
      return {
        label: "Queued",
        hint: "Awaiting bank response — reconciliation may still resolve this.",
      }
    case "unverified": {
      const err = r.error
      const msg =
        err && typeof err === "object" && !Array.isArray(err) &&
          typeof (err as Record<string, unknown>).message === "string"
          ? ((err as Record<string, unknown>).message as string)
          : "Not verified"
      return { label: "Unverified", hint: msg }
    }
    case "error": {
      const code = typeof r.code === "string" ? r.code : ""
      const msg = typeof r.message === "string" ? r.message : ""
      return {
        label: "Error",
        hint: [code, msg].filter(Boolean).join(": "),
      }
    }
    default:
      return { label: status, hint: "" }
  }
}

function getVerifiedSource(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.status !== "verified") return null
  const receipt = r.receipt
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return null
  }
  const source = (receipt as Record<string, unknown>).source
  return typeof source === "string" ? source : null
}

// ---------- Helpers ----------

function formatRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ---------- Skeleton / error ----------

function TableSkeleton() {
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
          <Skeleton className="h-3.5 w-24" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-8" />
        </div>
      ))}
    </div>
  )
}

function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Couldn&apos;t load payments</h3>
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