"use client"

import { motion } from "motion/react"
import {
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconReceipt,
  IconTrophy,
  IconX,
} from "@tabler/icons-react"

import { formatEtb } from "@/lib/utils"

export interface TicketCardData {
  id: string
  ticketNumber: string
  status: "VALID" | "WINNER" | "VOID"
  purchasedAt: Date
  lottery: {
    id: string
    name: string
    drawDate: Date
    status: "ACTIVE" | "CLOSED" | "DRAWN"
    ticketPriceEtb: number
    images: { id: string; url: string; isCover: boolean }[]
  }
  payment: {
    id: string
    amountEtb: number
    status: "PENDING" | "SUCCESS" | "FAILED"
    verifiedAt: Date | null
  }
  winningDraw: { id: string; drawTimestamp: Date } | null
}

const STATUS_CONFIG: Record<
  TicketCardData["status"],
  {
    label: string
    icon: typeof IconCheck
    className: string
    cardClassName: string
  }
> = {
  VALID: {
    label: "Valid",
    icon: IconCheck,
    className: "bg-primary/10 text-primary",
    cardClassName: "border-border bg-card",
  },
  WINNER: {
    label: "Winner",
    icon: IconTrophy,
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    cardClassName:
      "border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-amber-500/10",
  },
  VOID: {
    label: "Void",
    icon: IconX,
    className: "bg-muted text-muted-foreground",
    cardClassName: "border-border bg-muted/30",
  },
}

const PAYMENT_CONFIG: Record<
  TicketCardData["payment"]["status"],
  { label: string; icon: typeof IconCheck; className: string }
> = {
  SUCCESS: {
    label: "Paid",
    icon: IconCheck,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  PENDING: {
    label: "Pending",
    icon: IconClock,
    className: "text-muted-foreground",
  },
  FAILED: {
    label: "Failed",
    icon: IconX,
    className: "text-destructive",
  },
}

export function TicketCard({ ticket }: { ticket: TicketCardData }) {
  const status = STATUS_CONFIG[ticket.status]
  const StatusIcon = status.icon
  const payment = PAYMENT_CONFIG[ticket.payment.status]
  const PaymentIcon = payment.icon

  const cover =
    ticket.lottery.images.find((i) => i.isCover) ?? ticket.lottery.images[0]

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`overflow-hidden rounded-xl border shadow-sm ${status.cardClassName}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        {cover ? (
          <div className="size-11 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              alt={ticket.lottery.name}
              className="size-full object-cover"
              draggable={false}
            />
          </div>
        ) : (
          <div className="grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <IconReceipt className="size-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">
            {ticket.lottery.name}
          </h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconCalendarEvent className="size-3" />
            Draw {new Date(ticket.lottery.drawDate).toLocaleDateString()}
          </p>
        </div>

        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
          <StatusIcon className="size-3" />
          {status.label}
        </span>
      </div>

      {/* Perforated divider */}
      <div className="mx-4">
        <div className="border-t border-dashed border-border" />
      </div>

      {/* Ticket number */}
      <div className="px-4 py-4 text-center">
        <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Ticket number
        </div>
        <div className="mt-0.5 font-mono text-2xl font-bold tabular-nums tracking-[0.2em]">
          {ticket.ticketNumber}
        </div>

        {ticket.status === "WINNER" && ticket.winningDraw && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.25 }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
          >
            <IconTrophy className="size-3" />
            Won on{" "}
            {new Date(ticket.winningDraw.drawTimestamp).toLocaleDateString()}
          </motion.div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t bg-background/40 px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <IconReceipt className="size-3" />
          {formatEtb(ticket.payment.amountEtb)}
        </span>
        <span className={`flex items-center gap-1 ${payment.className}`}>
          <PaymentIcon className="size-3" />
          {payment.label}
        </span>
        <span>{new Date(ticket.purchasedAt).toLocaleDateString()}</span>
      </div>
    </motion.article>
  )
}