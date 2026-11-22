
# Database Schema Made with Prisma ORM v7

```prisma 
// ---------------------------------------------------------
// GENERATOR + DATASOURCE
// ---------------------------------------------------------

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ---------------------------------------------------------
// MODELS
// ---------------------------------------------------------

model User {
  id          String   @id @default(uuid())
  name        String
  telegramId  String   @unique @map("telegram_id")
  phoneNumber String?  @unique @map("phone_number")
  role        UserRole @default(USER)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  payments         Payment[]
  tickets          Ticket[]
  createdLotteries Lottery[]   @relation("LotteryCreatedBy")
  performedDraws   Draw[]      @relation("DrawPerformedBy")
  auditLogs        AuditLog[]

  @@map("users")
}

model Lottery {
  id               String        @id @default(uuid())
  name             String
  description      String?
  ticketPriceEtb   Decimal       @db.Decimal(10, 2) @map("ticket_price")
  totalTickets     Int?          @map("total_tickets")       // null = unlimited

  drawDate         DateTime      @map("draw_date")
  status           LotteryStatus @default(ACTIVE)
  createdByAdminId String?       @map("created_by_admin_id")
  createdAt        DateTime      @default(now()) @map("created_at")
  updatedAt        DateTime      @updatedAt @map("updated_at")

  createdByAdmin User?     @relation("LotteryCreatedBy", fields: [createdByAdminId], references: [id], onDelete: SetNull)
  tickets        Ticket[]
  payments       Payment[]
  images LotteryImage[]
  draw           Draw?

  @@index([status, drawDate])
  @@map("lotteries")
}

model LotteryImage {
  id        String   @id @default(uuid())
  lotteryId String   @map("lottery_id")

  url       String                        // object-storage key or public URL
  isCover   Boolean  @default(false) @map("is_cover")

  createdAt DateTime @default(now()) @map("created_at")

  lottery Lottery @relation(fields: [lotteryId], references: [id], onDelete: Cascade)

  @@index([lotteryId])
  @@map("lottery_images")
}

model Payment {
  id        String @id @default(uuid())
  userId    String @map("user_id")
  lotteryId String @map("lottery_id")

  // input from the user
  receiptText String  @unique @map("receipt_text")              // raw SMS / Telebirr receipt — also blocks duplicate submissions
  amountEtb   Decimal @db.Decimal(10, 2) @map("amount_etb")

  // result of automatic verification
  status        PaymentStatus @default(PENDING)
  verifiedAt    DateTime?     @map("verified_at")
  providerRaw   Json?         @map("provider_raw")              // raw response from Telebirr / parser

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt      @map("updated_at")

  user    User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  lottery Lottery  @relation(fields: [lotteryId], references: [id], onDelete: Cascade)
  tickets Ticket[]

  @@index([status])
  @@index([userId, status])
  @@index([lotteryId, status])
  @@map("payments")
}

model Ticket {
  id           String       @id @default(uuid())
  userId       String       @map("user_id")
  lotteryId    String       @map("lottery_id")
  paymentId    String       @map("payment_id")
  ticketNumber String       @map("ticket_number")
  status       TicketStatus @default(VALID)
  purchasedAt  DateTime     @default(now()) @map("purchased_at")
  updatedAt    DateTime     @updatedAt      @map("updated_at")

  user    User    @relation(fields: [userId], references: [id], onDelete: Restrict)
  lottery Lottery @relation(fields: [lotteryId], references: [id], onDelete: Cascade)
  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Restrict)

  winningDraw Draw? @relation("DrawWinner")

  @@unique([lotteryId, ticketNumber])   // ticket numbers restart per lottery
  @@index([userId, lotteryId])
  @@index([lotteryId, status])
  @@index([paymentId])
  @@map("tickets")
}

model Draw {
  id                 String   @id @default(uuid())
  lotteryId          String   @unique @map("lottery_id")        // one draw per lottery
  winningTicketId    String   @unique @map("winning_ticket_id")
  drawTimestamp      DateTime @default(now()) @map("draw_timestamp")
  performedByAdminId String?  @map("performed_by_admin_id")

  lottery          Lottery @relation(fields: [lotteryId], references: [id], onDelete: Cascade)
  winningTicket    Ticket  @relation("DrawWinner", fields: [winningTicketId], references: [id], onDelete: Restrict)
  performedByAdmin User?   @relation("DrawPerformedBy", fields: [performedByAdminId], references: [id], onDelete: SetNull)

  @@index([performedByAdminId])
  @@map("draws")
}

model AuditLog {
  id         String   @id @default(uuid())
  adminId    String?  @map("admin_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")

  admin User? @relation(fields: [adminId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@index([adminId, createdAt])
  @@map("audit_logs")
}


// ---------------------------------------------------------
// ENUMS
// ---------------------------------------------------------

enum UserRole {
  USER
  ADMIN
}

enum LotteryStatus {
  ACTIVE
  CLOSED
  DRAWN
}

enum TicketStatus {
  VALID
  WINNER
  VOID
}

enum PaymentStatus {
  PENDING
  SUCCESS
  FAILED
}
```

# Teck stack and there versions

```Json
{
  "name": "nextjs",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --webpack -H localhost",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@base-ui/react": "^1.8.0",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "^7.10.0",
    "@tabler/icons-react": "^3.46.0",
    "@vercel/blob": "^2.9.0",
    "better-auth": "^1.7.4",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.2.6",
    "dotenv": "^17.4.2",
    "grammy": "^1.46.0",
    "motion": "^13.2.0",
    "next": "16.3.5",
    "pg": "^8.23.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "shadcn": "^4.21.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/pg": "^8.23.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "^9",
    "eslint-config-next": "16.3.5",
    "prisma": "^7.10.0",
    "tailwindcss": "^4",
    "tsx": "^4.23.13",
    "typescript": "^5"
  }
}
```

# File folder structure of project 

```txt
├── .git
├── .next
├── node_modules
├── prisma
│   ├── migrations
│   └── schema.prisma
├── src
│   ├── actions
│   │   ├── admin.ts
│   │   └── user.ts
│   ├── app
│   │   ├── (admin)
│   │   │   └── admin
│   │   │       ├── auditlog
│   │   │       │   └── page.tsx
│   │   │       ├── lottery
│   │   │       │   └── page.tsx
│   │   │       ├── payment
│   │   │       │   └── page.tsx
│   │   │       ├── user
│   │   │       │   └── page.tsx
│   │   │       ├── layout.tsx
│   │   │       └── page.tsx
│   │   ├── (app)
│   │   │   ├── lottery
│   │   │   │   └── page.tsx
│   │   │   ├── profile
│   │   │   │   └── page.tsx
│   │   │   ├── ticket
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── (bot)
│   │   │   └── bot
│   │   │       └── route.ts
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components
│   │   ├── blocks
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── lottery-card.tsx
│   │   │   ├── profile.tsx
│   │   │   └── ticket-card.tsx
│   │   └── ui
│   │       ├── attachment.tsx
│   │       ├── avatar.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── empty.tsx
│   │       ├── input.tsx
│   │       ├── spinner.tsx
│   │       ├── table.tsx
│   │       ├── textarea.tsx
│   │       └── toast.tsx
│   ├── generated
│   │   └── prisma
│   │       ├── internal
│   │       │   ├── class.ts
│   │       │   └── prismaNames.ts
│   │       ├── models
│   │       │   ├── AuditLog.ts
│   │       │   ├── Draw.ts
│   │       │   ├── Lottery.ts
│   │       │   ├── LotteryImage.ts
│   │       │   ├── Payment.ts
│   │       │   ├── Ticket.ts
│   │       │   └── User.ts
│   │       ├── browser.ts
│   │       ├── client.ts
│   │       ├── commonInputTypes.ts
│   │       ├── enums.ts
│   │       └── models.ts
│   ├── hooks
│   │   └── use-mobile.ts
│   └── lib
│       ├── bot.ts
│       ├── get-user.ts
│       ├── payment.ts
│       ├── prisma.ts
│       ├── schema.ts
│       ├── upload.ts
│       └── utils.ts
├── .env
├── .gitignore
├── AI.md
├── components.json
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── postcss.config.mjs
├── prisma7.config.ts
├── README.md
├── tsconfig.json
└── tsconfig.tsbuildinfo
```


# Styling Rule and variable should use while designing components 

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```


Before writing any code, read and verify the latest official documentation for the technologies being used.

Use the official documentation as your primary reference. Follow the recommended patterns, APIs, best practices, and avoid deprecated methods. Do not guess implementations.

Documentation:

- Next.js: https://nextjs.org/docs
- React: https://react.dev/learn
- Prisma ORM: https://www.prisma.io/docs
- PostgreSQL: https://www.postgresql.org/docs/
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob
- grammY: https://grammy.dev/
- Zod: https://zod.dev/
- Motion ("motion.div"): https://motion.dev/docs/react
- shadcn/ui (Base UI): https://ui.shadcn.com/docs

Read the relevant documentation sections before implementing. Ensure all code is compatible with the current versions and the existing project structure. Prioritize type safety, security, clean architecture, performance, and maintainability.