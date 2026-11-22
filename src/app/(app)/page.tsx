import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAllLottery } from "@/actions/user"
import { LotteryList } from "@/components/blocks/lottery-list"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="flex flex-col items-center text-center gap-5 p-8">
            <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Car Lottery
            </span>

            <h1 className="text-4xl font-bold tracking-tight">
              Win Your <span className="text-muted-foreground">Dream Car</span>
            </h1>

            <p className="text-muted-foreground text-sm leading-6">
              Your dream car could be one ticket away. Join the lottery, get
              your ticket, and stand a chance to win.
            </p>

            <Button className="w-full h-12 text-base font-semibold">
              Explore Lotteries
            </Button>
          </CardContent>
        </Card>
      </section>
      <LotteryPage />

    </div>
  );
}



function LotteryPage() {
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