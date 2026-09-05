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

const categories = [
  {
    name: "Account and Access",
    isActive: true,
  },
  {
    name: "Hardware",
    isActive: true,
  },
  {
    name: "Software",
    isActive: true,
  },
  {
    name: "Network",
    isActive: true,
  },
];

const relatedSystems = [
  {
    name: "Corporate Laptop",
    isActive: true,
  },
  {
    name: "Campus Wi-Fi",
    isActive: true,
  },
  {
    name: "Email",
    isActive: true,
  },
  {
    name: "VPN",
    isActive: true,
  },
  {
    name: "Legacy System",
    isActive: false,
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        name: category.name,
      },
      update: {
        isActive: category.isActive,
      },
      create: category,
    });
  }

  for (const requester of requesters) {
    await prisma.requester.upsert({
      where: {
        email: requester.email,
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
  }

  for (const system of relatedSystems) {
    await prisma.relatedSystem.upsert({
      where: {
        name: system.name,
      },
      update: {
        isActive: system.isActive,
      },
      create: system,
    });
  }

  console.log(`Seeded ${categories.length} categories.`);
  console.log(`Seeded ${requesters.length} requesters.`);
  console.log(`Seeded ${relatedSystems.length} related systems.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });