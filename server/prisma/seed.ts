import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// The four names are: Account and Access, Hardware, Software, Network.
// Requirement: running the seed twice must NOT create duplicates.
async function main() {
  const prisma = getPrisma();
  const categories = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ] as const;

  try {
    for (const name of categories) {
      try {
        await prisma.category.upsert({
          where: { name },
          update: {},
          create: { name },
        });
      } catch (error) {
        console.error(`Failed to seed category "${name}"`, error);
        throw error;
      }
    }

    console.log(`Seeded ${categories.length} categories.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
