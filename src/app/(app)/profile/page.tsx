import { requireUser } from "@/lib/get-user"
import { Profile } from "@/components/blocks/profile"

export default async function ProfilePage() {
  const user = await requireUser()

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Profile user={user} />
    </main>
  )
}