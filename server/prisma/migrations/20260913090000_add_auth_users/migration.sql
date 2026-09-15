CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "legacyRequesterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_legacyRequesterId_key" ON "User"("legacyRequesterId");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "User_mustChangePassword_idx" ON "User"("mustChangePassword");
ALTER TABLE "User" ADD CONSTRAINT "User_legacyRequesterId_fkey" FOREIGN KEY ("legacyRequesterId") REFERENCES "Requester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "User" ("name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "legacyRequesterId", "createdAt", "updatedAt")
SELECT "name", lower("email"), 'scrypt:lab3-initial-salt:ce6778a1373212dd17a7f5515b31c79b94f3d54e2e3e9fc85110a90119f3c8756323be2dfa511243a56599934966eb1fcd42d3bc7fd0edcd96c41ec99f8a4c37', 'REQUESTER'::"UserRole", "isActive", true, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Requester";