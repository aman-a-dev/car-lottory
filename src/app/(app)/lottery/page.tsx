import { getAllLottery } from "@/actions/user"
import { LotteryList } from "@/components/blocks/lottery-list"

export default function LotteryPage() {
  const promise = getAllLottery()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Lotteries</h1>
        <p className="text-sm text-muted-foreground">
          Buy a ticket, get your chance to win.
        </p>
      </header>
      <LotteryList promise={promise} />
    </main>
  )
}