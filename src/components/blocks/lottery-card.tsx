"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconTicket,
} from "@tabler/icons-react"

import { Checkout } from "@/components/blocks/check-out"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatEtb } from "@/lib/utils"

export interface LotteryCardData {
  id: string
  name: string
  description: string | null
  ticketPriceEtb: number
  totalTickets: number | null
  drawDate: Date
  status: "ACTIVE" | "CLOSED" | "DRAWN"
  images: { id: string; url: string; isCover: boolean }[]
  ticketsSold: number
  ticketsRemaining: number | null
}

interface LotteryCardProps {
  lottery: LotteryCardData
}

export function LotteryCard({ lottery }: LotteryCardProps) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const images = lottery.images
  const current = images[index]
  const canParticipate = lottery.status === "ACTIVE"
  const soldOut = lottery.ticketsRemaining === 0

  const progress =
    lottery.totalTickets && lottery.totalTickets > 0
      ? Math.min(100, (lottery.ticketsSold / lottery.totalTickets) * 100)
      : 0

  const next = () => {
    setDirection(1)
    setIndex((i) => (i + 1) % images.length)
  }
  const prev = () => {
    setDirection(-1)
    setIndex((i) => (i - 1 + images.length) % images.length)
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {/* Carousel */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          {current ? (
            <motion.img
              key={current.id}
              src={current.url}
              alt={lottery.name}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%" }),
                center: { x: 0 },
                exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%" }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-0 size-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <IconTicket className="size-10" />
            </div>
          )}
        </AnimatePresence>

        {lottery.status !== "ACTIVE" && (
          <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium uppercase tracking-wide shadow-sm">
            {lottery.status}
          </span>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/85 shadow-sm transition-colors hover:bg-background"
            >
              <IconChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/85 shadow-sm transition-colors hover:bg-background"
            >
              <IconChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setDirection(i > index ? 1 : -1)
                    setIndex(i)
                  }}
                  aria-label={`Go to image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/60"
                    }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 text-lg font-semibold">{lottery.name}</h3>
          {lottery.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {lottery.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-primary">
            {formatEtb(lottery.ticketPriceEtb)}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <IconCalendarEvent className="size-4" />
            {new Date(lottery.drawDate).toLocaleDateString()}
          </span>
        </div>

        {lottery.totalTickets !== null && (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>{lottery.ticketsSold} sold</span>
              <span>{lottery.ticketsRemaining} left</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {/* Details dialog */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogTrigger render={

              <Button variant="outline" className="flex-1">
                View details
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{lottery.name}</DialogTitle>
                <DialogDescription>
                  {lottery.description ?? "No description provided."}
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y text-sm">
                <DetailRow label="Ticket price" value={formatEtb(lottery.ticketPriceEtb)} />
                <DetailRow
                  label="Draw date"
                  value={new Date(lottery.drawDate).toLocaleString()}
                />
                <DetailRow
                  label="Total tickets"
                  value={lottery.totalTickets === null ? "Unlimited" : String(lottery.totalTickets)}
                />
                <DetailRow label="Tickets sold" value={String(lottery.ticketsSold)} />
                {lottery.ticketsRemaining !== null && (
                  <DetailRow
                    label="Tickets remaining"
                    value={String(lottery.ticketsRemaining)}
                  />
                )}
                <DetailRow label="Status" value={lottery.status} />
              </dl>
            </DialogContent>
          </Dialog>

          {/* Checkout dialog */}
          <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
            <DialogTrigger render={
              <Button className="flex-1" disabled={!canParticipate || soldOut}>
                {soldOut ? "Sold out" : "Participate"}
              </Button>
            } />

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buy tickets</DialogTitle>
                <DialogDescription>{lottery.name}</DialogDescription>
              </DialogHeader>
              <Checkout
                lottery={{
                  id: lottery.id,
                  name: lottery.name,
                  ticketPriceEtb: lottery.ticketPriceEtb,
                  ticketsRemaining: lottery.ticketsRemaining,
                }}
                onSuccess={() => setCheckoutOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}