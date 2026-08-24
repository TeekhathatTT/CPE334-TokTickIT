import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requesters = [
  {
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    isActive: true,
  },
  {
    name: "Michael Chen",
    email: "michael.chen@example.com",
    isActive: true,
  },
  {
    name: "Sarah Williams",
    email: "sarah.williams@example.com",
    isActive: true,
  },
  {
    name: "David Brown",
    email: "david.brown@example.com",
    isActive: false,
  },
];

async function main() {
  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  console.log(`Seeded ${requesters.length} requesters.`);
}

main()
  .catch((error) => {
    console.error("Requester seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
