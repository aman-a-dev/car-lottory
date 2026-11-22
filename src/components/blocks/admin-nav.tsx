"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  IconMenu2,
  IconLayoutDashboard,
  IconTicket,
  IconCreditCard,
  IconUsers,
  IconClipboardList,
  IconArrowBackUp,
} from "@tabler/icons-react"
import { cn } from "cn"

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer"

type AdminNavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/admin/lottery", label: "Lottery", icon: IconTicket },
  { href: "/admin/payment", label: "Payment", icon: IconCreditCard },
  { href: "/admin/user", label: "User", icon: IconUsers },
  { href: "/admin/auditlog", label: "Audit Log", icon: IconClipboardList },
]

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="down">
      <DrawerTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border bg-popover px-5 py-2.5 text-sm font-medium text-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground"
        )}
        aria-label="Open admin navigation"
      >
        <IconMenu2 className="size-4.5" />
        Menu
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Admin Panel</DrawerTitle>
          <DrawerDescription>Manage lotteries, payments, and users</DrawerDescription>
        </DrawerHeader>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {adminNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.href)

            return (
              <DrawerClose key={item.href} render={

                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-4.5 shrink-0" />
                  {item.label}
                </Link>
              } />
            )
          })}
        </nav>

        <DrawerFooter>
          <DrawerClose render={

            <Link
              href="/"
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <IconArrowBackUp className="size-4.5 shrink-0" />
              Switch to User
            </Link>
          } />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
