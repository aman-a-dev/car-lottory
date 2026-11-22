import { getUsers } from "@/actions/admin"
import { UserList } from "@/components/blocks/user-list"

export default function AdminUserPage() {
  const promise = getUsers()

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Every registered user, their activity, and their tickets.
        </p>
      </header>
      <UserList promise={promise} />
    </main>
  )
}