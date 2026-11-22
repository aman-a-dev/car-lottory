import prisma from "@/lib/prisma"

async function main() {
  const userId = "47d921de-6c2d-4aad-80d5-0d995793c55b";

  const deletedUser = await prisma.user.deleteMany({
    where: {
      id: userId,
    },
  });

  console.log(`Deleted ${deletedUser.count} user(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });