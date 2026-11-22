"use client"

import {
  IconBrandTelegram,
  IconCalendar,
  IconExternalLink,
  IconHeadset,
  IconPhone,
  IconShieldCheck,
} from "@tabler/icons-react"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export interface ProfileUser {
  name: string
  telegramId: string
  phoneNumber: string | null
  role: "USER" | "ADMIN"
  createdAt: Date
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U"
  )
}

export function Profile({ user }: { user: ProfileUser }) {
  const isAdmin = user.role === "ADMIN"
  const initials = getInitials(user.name)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 py-4">
        <Avatar className="size-20">
          <AvatarFallback className="text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">
              {user.name}
            </h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <IconShieldCheck className="size-3" />
                Admin
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Telegram user · {user.telegramId}
          </p>
        </div>
      </div>

      {/* Info + support */}
      <ItemGroup>
        <Item variant="outline">
          <ItemMedia variant="icon">
            <IconBrandTelegram />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Telegram ID</ItemTitle>
            <ItemDescription>{user.telegramId}</ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon">
            <IconPhone />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Phone number</ItemTitle>
            <ItemDescription>{user.phoneNumber ?? "Not set"}</ItemDescription>
          </ItemContent>
        </Item>

        <Item variant="outline">
          <ItemMedia variant="icon">
            <IconCalendar />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Member since</ItemTitle>
            <ItemDescription>
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </ItemDescription>
          </ItemContent>
        </Item>

        {isAdmin && (
          <Item variant="muted" render={
            <Link href="/admin" />
          }>
            <ItemMedia variant="icon">
              <IconShieldCheck className="text-primary" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Administrator</ItemTitle>
              <ItemDescription>
                You have admin access to manage lotteries, payments, and users.
              </ItemDescription>
            </ItemContent>

          </Item>
        )}

        <Item
          variant="outline"
          render={
            <a
              href="https://t.me/Aman_a_dev"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <ItemMedia variant="icon">
            <IconHeadset />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Support</ItemTitle>
            <ItemDescription>Contact @Aman_a_dev on Telegram</ItemDescription>
          </ItemContent>
          <ItemActions>
            <IconExternalLink className="size-4 text-muted-foreground" />
          </ItemActions>
        </Item>
      </ItemGroup>
    </div>
  )
}