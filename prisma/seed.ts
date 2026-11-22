// prisma/seed.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// mirror src/lib/prisma.ts (no global cache needed for a one-shot script)
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const DEMO_LOTTERIES = [
  {
    name: "Mega Cash Prize",
    description:
      "Buy a ticket for a chance to win 1,000,000 ETB. Draw happens once all tickets are sold or on the draw date.",
    ticketPriceEtb: "100.00",
    totalTickets: 10_000,
    drawDate: daysFromNow(7),
    status: "ACTIVE" as const,
  },
  {
    name: "iPhone 17 Pro Max Giveaway",
    description:
      "Win the latest iPhone 17 Pro Max. Limited tickets — grab yours before they sell out!",
    ticketPriceEtb: "50.00",
    totalTickets: 2_000,
    drawDate: daysFromNow(3),
    status: "ACTIVE" as const,
  },
  {
    name: "Weekend Getaway Package",
    description:
      "A luxury two-night weekend getaway for two at a 5-star resort. Includes meals and transport.",
    ticketPriceEtb: "200.00",
    totalTickets: 500,
    drawDate: daysFromNow(14),
    status: "ACTIVE" as const,
  },
];

async function main() {
  console.log("🌱 Seeding demo lotteries...\n");

  for (const data of DEMO_LOTTERIES) {
    const existing = await prisma.lottery.findFirst({
      where: { name: data.name },
      select: { id: true },
    });

    if (existing) {
      console.log(`⏭️  Skipping (already exists): ${data.name}`);
      continue;
    }

    const lottery = await prisma.lottery.create({ data });
    console.log(`✅ Created: ${lottery.name}`);
    console.log(`   id:           ${lottery.id}`);
    console.log(`   price:        ${lottery.ticketPriceEtb} ETB`);
    console.log(`   totalTickets: ${lottery.totalTickets}`);
    console.log(`   drawDate:     ${lottery.drawDate.toISOString()}\n`);
  }

  const total = await prisma.lottery.count();
  console.log(`📊 Total lotteries in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });