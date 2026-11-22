import { getTickets, type AdminTicketStatus } from "@/actions/admin"
import { TicketAdmin } from "@/components/blocks/ticket-admin"

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminTicketPage({ searchParams }: PageProps) {
  const { status } = await searchParams
  const parsedStatus =
    status === "VALID" || status === "WINNER" || status === "VOID"
      ? (status as AdminTicketStatus)
      : undefined

  // Do NOT await — the table owns loading / error / empty.
  const promise = getTickets({ status: parsedStatus })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Every issued ticket with the buyer, lottery, payment, and result.
        </p>
      </header>
      <TicketAdmin promise={promise} />
    </main>
  )
}