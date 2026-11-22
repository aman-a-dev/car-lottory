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
  IconBroadcast,
  IconChevronDown,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconShield,
  IconTrash,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

// ---------- Types (matches getAudit in admin.ts) ----------

export interface AuditLogItem {
  id: string
  adminId: string | null
  action: string
  entityType: string
  entityId: string
  metadata: unknown
  createdAt: Date
  admin: { id: string; name: string } | null
}

export interface AuditResult {
  total: number
  take: number
  skip: number
  items: AuditLogItem[]
}

// ---------- Action config ----------

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof IconPlus; className: string }
> = {
  "lottery.create": {
    label: "Lottery created",
    icon: IconPlus,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "lottery.update": {
    label: "Lottery updated",
    icon: IconEdit,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  "lottery.delete": {
    label: "Lottery deleted",
    icon: IconTrash,
    className: "bg-destructive/10 text-destructive",
  },
  "message.broadcast": {
    label: "Broadcast sent",
    icon: IconBroadcast,
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
}

const ENTITY_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "Lottery", label: "Lotteries" },
  { value: "User", label: "Users" },
]

function actionConfig(action: string) {
  return (
    ACTION_CONFIG[action] ?? {
      label: action,
      icon: IconShield,
      className: "bg-muted text-muted-foreground",
    }
  )
}

// ---------- Public entry ----------

export function AuditAdmin({ promise }: { promise: Promise<AuditResult> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  const currentFilter = searchParams.get("entityType") ?? "ALL"

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

  const setFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "ALL") params.delete("entityType")
    else params.set("entityType", value)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {ENTITY_FILTERS.map((f) => {
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
            <AuditSkeleton />
          ) : (
            <ListError onRetry={handleRetry} />
          )
        }
      >
        <Suspense fallback={<AuditSkeleton />}>
          <Inner promise={promise} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

// ---------- Inner ----------

function Inner({ promise }: { promise: Promise<AuditResult> }) {
  const result = use(promise)

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconShield />
          </EmptyMedia>
          <EmptyTitle>No audit entries</EmptyTitle>
          <EmptyDescription>
            Nothing has been logged for this filter yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ul className="divide-y">
          {result.items.map((entry, i) => (
            <motion.li
              key={entry.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: Math.min(i * 0.02, 0.3),
                ease: "easeOut",
              }}
            >
              <AuditRow entry={entry} />
            </motion.li>
          ))}
        </ul>
      </div>

      {result.total > result.items.length && (
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Showing {result.items.length} of {result.total} entries
        </p>
      )}
    </>
  )
}

// ---------- Row ----------

function AuditRow({ entry }: { entry: AuditLogItem }) {
  const [expanded, setExpanded] = useState(false)
  const config = actionConfig(entry.action)
  const Icon = config.icon
  const hasMetadata =
    entry.metadata !== null && entry.metadata !== undefined

  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            config.className,
          )}
        >
          <Icon className="size-4" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium">{config.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {entry.entityType} ·{" "}
              <span className="font-mono">{shortId(entry.entityId)}</span>
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span>
              by{" "}
              <span className="font-medium text-foreground">
                {entry.admin?.name ?? "system"}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>{formatDateTime(entry.createdAt)}</span>
          </div>

          {hasMetadata && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <IconChevronDown
                  className={cn(
                    "size-3 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
                {expanded ? "Hide details" : "Show details"}
              </button>

              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <MetadataView metadata={entry.metadata} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- Metadata ----------

function MetadataView({ metadata }: { metadata: unknown }) {
  // Human-readable summary for known action shapes; JSON fallback otherwise.
  const summary = summarizeMetadata(metadata)

  return (
    <div className="mt-2 space-y-1.5">
      {summary.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md bg-muted/50 p-2 text-[11px]">
          {summary.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="break-all font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer font-medium hover:text-foreground">
          Raw JSON
        </summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[10px] leading-relaxed">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    </div>
  )
}

/** Turns known metadata shapes into [label, value] rows for a small key-value table. */
function summarizeMetadata(metadata: unknown): [string, string][] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return []
  }
  const obj = metadata as Record<string, unknown>
  const rows: [string, string][] = []

  if (typeof obj.name === "string") rows.push(["Name", obj.name])
  if (typeof obj.imageCount === "number")
    rows.push(["Images", String(obj.imageCount)])
  if (typeof obj.imagesAdded === "number")
    rows.push(["Images added", String(obj.imagesAdded)])
  if (typeof obj.imagesRemoved === "number")
    rows.push(["Images removed", String(obj.imagesRemoved)])
  if (Array.isArray(obj.changed))
    rows.push(["Fields", obj.changed.join(", ")])
  if (typeof obj.tickets === "number")
    rows.push(["Tickets affected", String(obj.tickets)])
  if (typeof obj.total === "number") rows.push(["Recipients", String(obj.total)])
  if (typeof obj.sent === "number") rows.push(["Sent", String(obj.sent)])
  if (typeof obj.failed === "number") rows.push(["Failed", String(obj.failed)])
  if (typeof obj.exceptionCount === "number")
    rows.push(["Excluded", String(obj.exceptionCount)])

  return rows
}

// ---------- Helpers ----------

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function formatDateTime(date: Date): string {
  const d = new Date(date)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ---------- Loading ----------

function AuditSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-b px-4 py-3 last:border-b-0">
          <div className="flex items-start gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
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
        <h3 className="text-base font-semibold">Couldn&apos;t load audit log</h3>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching entries. Please try again.
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