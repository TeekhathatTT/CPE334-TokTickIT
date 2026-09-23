// E2E authentication fixtures — run by client/e2e/global-setup.ts before every
// Playwright run so the specs always start from a deterministic auth state:
//
// * login-ready users can sign in straight through (known password, no forced
//   password change),
// * one dedicated user still has mustChangePassword=true so the forced
//   change-password flow is exercised without blocking the other specs.
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

const PASSWORD = "TokTickit1!";

const loginReady = [
  "jennifer.anderson@example.com", // REQUESTER — lab-02 create-ticket flow
  "alex.morgan@example.com", // IT_STAFF — staff-ticket-flow
  "morgan.davis@example.com", // ADMINISTRATOR — user-administration + admin login
];

const mustChange = ["priya.patel@example.com"]; // forced change-password flow

async function main() {
  const passwordHash = hashPassword(PASSWORD);
  for (const email of loginReady) {
    await prisma.user.updateMany({
      where: { email },
      data: { passwordHash, mustChangePassword: false, isActive: true },
    });
  }
  for (const email of mustChange) {
    await prisma.user.updateMany({
      where: { email },
      data: { passwordHash, mustChangePassword: true, isActive: true },
    });
  }
  console.log(`E2E auth fixtures ready (${loginReady.length} login-ready, ${mustChange.length} forced-change).`);
}

main()
  .catch((error) => {
    console.error("E2E setup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });