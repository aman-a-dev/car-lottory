import { getDashboardStats } from "@/actions/admin"
import { AdminDashboard } from "@/components/blocks/admin-dashboard"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { IconPlus } from "@tabler/icons-react"

export default function AdminHomePage() {
  // Do NOT await — the dashboard owns loading / error states.
  const promise = getDashboardStats()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of users, tickets, revenue, and recent activity.
          </p>
        </div>
        <Button render={<Link href="/admin/lottery" />}>
          <IconPlus className="size-4" />
          Create lottery
        </Button>
      </header>
      <AdminDashboard promise={promise} />
    </main>
  )
}