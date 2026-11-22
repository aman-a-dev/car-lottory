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
  IconPlus,
  IconRefresh,
  IconTicket,
} from "@tabler/icons-react"

import { TicketCard, type TicketCardData } from "@/components/blocks/ticket-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// ---------- Public entry ----------

interface TicketListProps {
  promise: Promise<TicketCardData[]>
}

/**
 * Renders the user's purchased tickets with loading skeleton, error state, and
 * empty CTA built-in. Pass a **promise** (not awaited data) from the server
 * component so the boundaries live here instead of `loading.tsx` / `error.tsx`.
 */
export function TicketList({ promise }: TicketListProps) {
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
        isRetrying ? (
          <TicketListSkeleton />
        ) : (
          <TicketListError onRetry={handleRetry} />
        )
      }
    >
      <Suspense fallback={<TicketListSkeleton />}>
        <TicketListInner promise={promise} />
      </Suspense>
    </ErrorBoundary>
  )
}

// ---------- Inner ----------

function TicketListInner({
  promise,
}: {
  promise: Promise<TicketCardData[]>
}) {
  const tickets = use(promise)

  if (tickets.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconTicket />
          </EmptyMedia>
          <EmptyTitle>No tickets yet</EmptyTitle>
          <EmptyDescription>
            Buy a ticket to any active lottery and it will appear here.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/lottery" />}>
            <IconPlus className="size-4" />
            Browse lotteries
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: 0.05, delayChildren: 0.02 },
        },
      }}
    >
      {tickets.map((ticket) => (
        <motion.div
          key={ticket.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <TicketCard ticket={ticket} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// ---------- Loading ----------

function TicketListSkeleton() {
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
          <div className="flex items-center gap-3 p-3">
            <Skeleton className="size-11 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="mx-4 border-t border-dashed border-border" />
          <div className="flex flex-col items-center gap-2 py-4">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-7 w-32" />
          </div>
          <div className="flex items-center justify-between border-t bg-background/40 px-4 py-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Error ----------

function TicketListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Couldn&apos;t load tickets</h3>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching your tickets. Please try again.
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