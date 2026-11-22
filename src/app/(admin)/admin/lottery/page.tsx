import { getLotteryAdmin } from "@/actions/admin"
import { LotteryAdmin } from "@/components/blocks/lottery-admin"

export default function AdminLotteryPage() {
  // Do NOT await — the list owns loading / error / empty.
  const promise = getLotteryAdmin()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lotteries</h1>
        <p className="text-sm text-muted-foreground">
          Manage every lottery on the platform.
        </p>
      </header>
      <LotteryAdmin promise={promise} />
    </main>
  )
}