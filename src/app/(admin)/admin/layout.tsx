import { AdminNav } from "@/components/blocks/admin-nav"

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div>
      <header className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2">
        <AdminNav />
      </header>
      <main>{children}</main>
    </div>
  )
}