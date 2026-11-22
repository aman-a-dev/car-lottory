import { getAudit } from "@/actions/admin"
import { AuditAdmin } from "@/components/blocks/audit-admin"

interface PageProps {
  searchParams: Promise<{ entityType?: string }>
}

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  const { entityType } = await searchParams
  // Only forward values we actually support — don't let arbitrary strings
  // reach the DB filter (Prisma treats unknown entityType as zero results
  // anyway, but tightening at the boundary is cheap).
  const valid =
    entityType === "Lottery" || entityType === "User" ? entityType : undefined

  // Note: getAudit() does not currently accept entityType — see note below.
  const promise = getAudit({ entityType: valid })

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every admin action, in reverse-chronological order.
        </p>
      </header>
      <AuditAdmin promise={promise} />
    </main>
  )
}