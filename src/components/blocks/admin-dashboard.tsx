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
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowUpRight,
  IconBroadcast,
  IconCalendarEvent,
  IconCash,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconShield,
  IconTicket,
  IconTrash,
  IconTrophy,
  IconUsers,
} from "@tabler/icons-react"

import type { DashboardStats } from "@/actions/admin"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn, formatEtb } from "@/lib/utils"

// ---------- Public entry ----------

export function AdminDashboard({ promise }: { promise: Promise<DashboardStats> }) {
  const router = useRouter()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

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

  return (
    <ErrorBoundary
      key={retryKey}
      fallback={
        isRetrying ? <DashboardSkeleton /> : <DashboardError onRetry={handleRetry} />
      }
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <Inner promise={promise} />
      </Suspense>
    </ErrorBoundary>
  )
}

// ---------- Inner ----------

function Inner({ promise }: { promise: Promise<DashboardStats> }) {
  const stats = use(promise)

  return (
    <div className="space-y-6">
      <StatsGrid stats={stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PaymentBreakdown payments={stats.payments} />
        <TopLotteries lotteries={stats.topLotteries} />
      </div>
      <RecentActivity items={stats.recentAudit} />
    </div>
  )
}

// ---------- Stats grid ----------

function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <motion.div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.05, delayChildren: 0.02 },
        },
      }}
    >
      <StatCard
        icon={IconUsers}
        label="Total users"
        value={stats.users.total.toLocaleString()}
        hint={`+${stats.users.newLast7Days} this week`}
        accent="text-sky-600 dark:text-sky-400 bg-sky-500/10"
      />
      <StatCard
        icon={IconTicket}
        label="Tickets sold"
        value={stats.tickets.total.toLocaleString()}
        hint={`+${stats.tickets.soldLast7Days} this week`}
        accent="text-violet-600 dark:text-violet-400 bg-violet-500/10"
      />
      <StatCard
        icon={IconCash}
        label="Revenue"
        value={formatEtb(stats.payments.revenueEtb)}
        hint={`+${formatEtb(stats.payments.revenueLast7Days)} this week`}
        accent="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      />
      <StatCard
        icon={IconTrophy}
        label="Active lotteries"
        value={String(stats.lotteries.active)}
        hint={
          stats.lotteries.upcomingDraws > 0
            ? `${stats.lotteries.upcomingDraws} upcoming draw${stats.lotteries.upcomingDraws === 1 ? "" : "s"}`
            : "No upcoming draws"
        }
        accent="text-amber-600 dark:text-amber-400 bg-amber-500/10"
      />
    </motion.div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof IconUsers
  label: string
  value: string
  hint: string
  accent: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="h-full">
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <span className={cn("grid size-7 place-items-center rounded-full", accent)}>
              <Icon className="size-4" />
            </span>
          </div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ---------- Payment breakdown ----------

function PaymentBreakdown({ payments }: { payments: DashboardStats["payments"] }) {
  const total = payments.total || 1
  const rows = [
    {
      label: "Successful",
      count: payments.success,
      pct: (payments.success / total) * 100,
      bar: "bg-emerald-500",
      dot: "bg-emerald-500",
    },
    {
      label: "Pending",
      count: payments.pending,
      pct: (payments.pending / total) * 100,
      bar: "bg-amber-500",
      dot: "bg-amber-500",
    },
    {
      label: "Failed",
      count: payments.failed,
      pct: (payments.failed / total) * 100,
      bar: "bg-destructive",
      dot: "bg-destructive",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payments</CardTitle>
        <CardDescription>
          {payments.total} total · {formatEtb(payments.revenueEtb)} collected
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", row.dot)} />
                {row.label}
              </span>
              <span className="font-medium tabular-nums">
                {row.count}{" "}
                <span className="text-muted-foreground">
                  ({row.pct.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn("h-full", row.bar)}
                initial={{ width: 0 }}
                animate={{ width: `${row.pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}

        <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-3 text-[11px]">
          <MiniStat label="Valid" value={payments.success} />
          <MiniStat label="Pending" value={payments.pending} />
          <MiniStat label="Failed" value={payments.failed} />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  )
}

// ---------- Top lotteries ----------

function TopLotteries({
  lotteries,
}: {
  lotteries: DashboardStats["topLotteries"]
}) {
  const max = lotteries[0]?.ticketsSold || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top lotteries</CardTitle>
        <CardDescription>By tickets sold</CardDescription>
      </CardHeader>
      <CardContent>
        {lotteries.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No lotteries yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {lotteries.map((l, i) => (
              <li key={l.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="truncate font-medium">{l.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {l.ticketsSold} · {formatEtb(l.revenueEtb)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${(l.ticketsSold / max) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.05 }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ---------- Recent activity ----------

const AUDIT_ICONS: Record<string, { icon: typeof IconShield; className: string }> = {
  "lottery.create": {
    icon: IconPlus,
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  "lottery.update": {
    icon: IconEdit,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  "lottery.delete": {
    icon: IconTrash,
    className: "bg-destructive/10 text-destructive",
  },
  "message.broadcast": {
    icon: IconBroadcast,
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
}

const AUDIT_LABELS: Record<string, string> = {
  "lottery.create": "created a lottery",
  "lottery.update": "updated a lottery",
  "lottery.delete": "deleted a lottery",
  "message.broadcast": "sent a broadcast",
}

function RecentActivity({ items }: { items: DashboardStats["recentAudit"] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Latest admin actions</CardDescription>
        </div>
        <Link
          href="/admin/auditlog"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View all
          <IconArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No activity yet.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => {
              const cfg = AUDIT_ICONS[item.action] ?? {
                icon: IconShield,
                className: "bg-muted text-muted-foreground",
              }
              const Icon = cfg.icon
              const label = AUDIT_LABELS[item.action] ?? item.action

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      cfg.className,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">
                      <span className="font-medium">
                        {item.adminName ?? "system"}
                      </span>{" "}
                      <span className="text-muted-foreground">{label}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelative(item.createdAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
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
  if (d < 7) return `${d}d ago`
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

// ---------- Loading ----------

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 pt-6">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-2.5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- Error ----------

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Couldn&apos;t load dashboard</h3>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching stats. Please try again.
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