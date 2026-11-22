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
import { useRouter } from "next/navigation"
import { IconAlertTriangle, IconRefresh, IconTicket } from "@tabler/icons-react"

import { LotteryCard, type LotteryCardData } from "@/components/blocks/lottery-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// ---------- Public entry ----------

interface LotteryListProps {
  promise: Promise<LotteryCardData[]>
}

/**
 * Renders the lottery grid with built-in loading skeleton and error state.
 *
 * Pass a **promise** (not awaited data) from the server component so both
 * loading and error boundaries live here, not in `loading.tsx` / `error.tsx`.
 */
export function LotteryList({ promise }: LotteryListProps) {
  const router = useRouter()
  const promiseRef = useRef(promise)
  const [retryKey, setRetryKey] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  // A new promise arrives whenever `router.refresh()` completes.
  // Remount the boundary so the fresh promise gets a chance to render.
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
        isRetrying ? (
          <LotteryListSkeleton />
        ) : (
          <LotteryListError onRetry={handleRetry} />
        )
      }
    >
      <Suspense fallback={<LotteryListSkeleton />}>
        <LotteryListInner promise={promise} />
      </Suspense>
    </ErrorBoundary>
  )
}

// ---------- Inner (reads the promise via `use`) ----------

function LotteryListInner({ promise }: { promise: Promise<LotteryCardData[]> }) {
  const lotteries = use(promise)

  if (lotteries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconTicket />
          </EmptyMedia>
          <EmptyTitle>No active lotteries</EmptyTitle>
          <EmptyDescription>Check back soon for new draws.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
      }}
    >
      {lotteries.map((lottery) => (
        <motion.div
          key={lottery.id}
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <LotteryCard lottery={lottery} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// ---------- Loading (skeleton mirrors real card layout) ----------

function LotteryListSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Error ----------

function LotteryListError({ onRetry }: { onRetry: () => void }) {
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

// ---------- Error boundary (class-based; react-error-boundary isn't installed) ----------

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