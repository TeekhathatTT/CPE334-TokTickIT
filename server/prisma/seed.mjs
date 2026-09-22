import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

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
  {
    name: "Priya Patel",
    email: "priya.patel@example.com",
    isActive: true,
  },
];

const users = [
  ...requesters.map((requester) => ({ ...requester, role: "REQUESTER" })),
  { name: "Alex Morgan", email: "alex.morgan@example.com", isActive: true, role: "IT_STAFF" },
  { name: "Jordan Lee", email: "jordan.lee@example.com", isActive: true, role: "IT_STAFF" },
  { name: "Taylor Smith", email: "taylor.smith@example.com", isActive: true, role: "IT_STAFF" },
  { name: "Casey Wilson", email: "casey.wilson@example.com", isActive: false, role: "IT_STAFF" },
  { name: "Morgan Davis", email: "morgan.davis@example.com", isActive: true, role: "ADMINISTRATOR" },
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

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

  const requesterRows = new Map();
  for (const requester of requesters) {
    const row = await prisma.requester.upsert({
      where: {
        email: requester.email,
      },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: requester,
    });
    requesterRows.set(requester.email, row);
  }

  for (const user of users) {
    const requester = requesterRows.get(user.email);
    await prisma.user.upsert({
      where: { email: user.email },
      // Only update profile fields — never reset a password that an admin
      // may have already changed. Passwords and mustChangePassword are set
      // only when the row is first created.
      update: { name: user.name, role: user.role, isActive: user.isActive, legacyRequesterId: requester?.id ?? null },
      create: { name: user.name, email: user.email, role: user.role, isActive: user.isActive, passwordHash: hashPassword("TokTickit1!"), mustChangePassword: true, legacyRequesterId: requester?.id ?? null },
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
  console.log(`Seeded ${requesters.length} requesters and ${users.length} users.`);
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