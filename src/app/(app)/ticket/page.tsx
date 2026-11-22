import { getUserTickets } from "@/actions/user"
import { TicketList } from "@/components/blocks/ticket-list"

export default function TicketPage() {
  const promise = getUserTickets()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
        <p className="text-sm text-muted-foreground">
          Every ticket you own across all lotteries.
        </p>
      </header>
      <TicketList promise={promise} />
    </main>
  )
}