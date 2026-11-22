"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { IconHome, IconTicket, IconUser, IconGift } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/lottery", label: "Lottery", icon: IconGift },
  { href: "/ticket", label: "Tickets", icon: IconTicket },
  { href: "/profile", label: "Profile", icon: IconUser },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-10 left-3 right-3 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 rounded-lg bg-primary/10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <motion.span
                className="relative z-10 flex flex-col items-center gap-1"
                animate={{ scale: active ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className={cn(
                    "transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
