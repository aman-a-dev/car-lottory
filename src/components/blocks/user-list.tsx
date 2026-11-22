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
import {
  IconAlertTriangle,
  IconBrandTelegram,
  IconCalendar,
  IconChevronRight,
  IconPhone,
  IconRefresh,
  IconShieldCheck,
  IconTicket,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"

import { getUserDetail, type UserDetail } from "@/actions/admin"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { formatEtb } from "@/lib/utils"

// ---------- Types ----------

export interface AdminUserItem {
  id: string
  name: string
  telegramId: string
  phoneNumber: string | null
  role: "USER" | "ADMIN"
  createdAt: Date
  ticketsCount: number
  paymentsCount: number
}

export interface UsersResult {
  total: number
  take: number
  skip: number
  items: AdminUserItem[]
}

// ---------- Public entry ----------

interface UserListProps {
  promise: Promise<UsersResult>
}

export function UserList({ promise }: UserListProps) {
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
          <UserListSkeleton />
        ) : (
          <UserListError onRetry={handleRetry} />
        )
      }
    >
      <Suspense fallback={<UserListSkeleton />}>
        <UserListInner promise={promise} />
      </Suspense>
    </ErrorBoundary>
  )
}

// ---------- Inner ----------

function UserListInner({ promise }: { promise: Promise<UsersResult> }) {
  const result = use(promise)

  if (result.items.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconUsers />
          </EmptyMedia>
          <EmptyTitle>No users yet</EmptyTitle>
          <EmptyDescription>
            Users will appear here once they sign in through Telegram.
          </EmptyDescription>
        </EmptyHeader>
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
          transition: { staggerChildren: 0.04, delayChildren: 0.02 },
        },
      }}
    >
      {result.items.map((user) => (
        <motion.div
          key={user.id}
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <AdminUserCard user={user} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// ---------- Card ----------

function AdminUserCard({ user }: { user: AdminUserItem }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isAdmin = user.role === "ADMIN"
  const initials = getInitials(user.name)

  const handleOpen = (next: boolean) => {
    setOpen(next)
    if (!next || detail) return

    setIsLoading(true)
    getUserDetail(user.id)
      .then(setDetail)
      .catch((err) => {
        toast.add({
          title: "Failed to load user details",
          description: err instanceof Error ? err.message : undefined,
          type: "error",
        })
      })
      .finally(() => setIsLoading(false))
  }

  return (
    <>
      <Item
        variant="outline"
        render={
          <button
            type="button"
            onClick={() => handleOpen(true)}
            className="text-left"
          />
        }
        className="w-full cursor-pointer"
      >
        <ItemMedia>
          <Avatar className="size-10">
            <AvatarFallback className="text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </ItemMedia>

        <ItemContent>
          <ItemTitle className="flex items-center gap-1.5">
            <span className="truncate">{user.name}</span>
            {isAdmin && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <IconShieldCheck className="size-2.5" />
                Admin
              </span>
            )}
          </ItemTitle>
          <ItemDescription>
            {user.ticketsCount} ticket{user.ticketsCount === 1 ? "" : "s"} ·{" "}
            {user.paymentsCount} payment{user.paymentsCount === 1 ? "" : "s"}
          </ItemDescription>
        </ItemContent>

        <ItemActions>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </ItemActions>
      </Item>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{user.name}</DialogTitle>
            <DialogDescription>
              {isAdmin ? "Administrator" : "Telegram user"} ·{" "}
              {user.telegramId}
            </DialogDescription>
          </DialogHeader>

          {isLoading && !detail ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : detail ? (
            <UserDetailContent detail={detail} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Could not load user details.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- Detail ----------

function UserDetailContent({ detail }: { detail: UserDetail }) {
  return (
    <div className="space-y-5">
      <ItemGroup>
        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <IconBrandTelegram />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Telegram ID</ItemTitle>
            <ItemDescription>{detail.telegramId}</ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <IconPhone />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Phone</ItemTitle>
            <ItemDescription>
              {detail.phoneNumber ?? "Not set"}
            </ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <IconCalendar />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Joined</ItemTitle>
            <ItemDescription>
              {new Date(detail.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <IconUser />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Role</ItemTitle>
            <ItemDescription>
              {detail.role === "ADMIN" ? "Administrator" : "User"}
            </ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <IconTicket className="size-4" />
            Tickets
          </h4>
          <span className="text-xs text-muted-foreground">
            {detail.tickets.length}
          </span>
        </div>

        {detail.tickets.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No tickets purchased yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.tickets.map((ticket) => {
              const cover =
                ticket.lottery.images.find((i) => i.isCover) ??
                ticket.lottery.images[0]
              return (
                <li
                  key={ticket.id}
                  className="flex items-center gap-3 rounded-md border bg-card p-2.5 text-xs"
                >
                  {cover ? (
                    <div className="size-9 shrink-0 overflow-hidden rounded bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover.url}
                        alt={ticket.lottery.name}
                        className="size-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="grid size-9 shrink-0 place-items-center rounded bg-muted text-muted-foreground">
                      <IconTicket className="size-4" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {ticket.lottery.name}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      #{ticket.ticketNumber}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-medium">
                      {formatEtb(ticket.payment.amountEtb)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(ticket.purchasedAt).toLocaleDateString()}
                    </div>
                  </div>

                  <TicketStatusBadge status={ticket.status} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function TicketStatusBadge({
  status,
}: {
  status: "VALID" | "WINNER" | "VOID"
}) {
  const config = {
    VALID: { label: "Valid", className: "bg-primary/10 text-primary" },
    WINNER: {
      label: "Winner",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    VOID: {
      label: "Void",
      className: "bg-muted text-muted-foreground",
    },
  }[status]

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  )
}

// ---------- Helpers ----------

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  )
}

// ---------- Loading ----------

function UserListSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="size-4 rounded-sm" />
        </div>
      ))}
    </div>
  )
}

// ---------- Error ----------

function UserListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-10 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <IconAlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Couldn&apos;t load users</h3>
        <p className="text-sm text-muted-foreground">
          Something went wrong while fetching the user list. Please try again.
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