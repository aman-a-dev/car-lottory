import {
  getPayments,
  type AdminPaymentStatus,
} from "@/actions/admin"
import { PaymentAdmin } from "@/components/blocks/payment-admin"

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function AdminPaymentPage({ searchParams }: PageProps) {
  const { status } = await searchParams
  const parsedStatus =
    status === "PENDING" || status === "SUCCESS" || status === "FAILED"
      ? (status as AdminPaymentStatus)
      : undefined

  const promise = getPayments({ status: parsedStatus })

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Every receipt submission with its verification outcome.
        </p>
      </header>
      <PaymentAdmin promise={promise} />
    </main>
  )
}