-- Lab 3 migration step 1/2: User/role schema, ticket ownership relation, comments/notes models.
-- Spec source: docs/lab-03/specification.md §8 (Data Changes) + §12 Assumptions + BR-08/BR-11/BR-18/BR-22.
-- Strategy: REFERENCE (not merge). Keep `Requester` untouched; add `User` with
--   `legacyRequesterId` link; add `Ticket.requesterUserId` ownership trail;
--   `Ticket.requesterId` remains as legacy provenance.
-- This step adds the 4 new TicketStatus values (WAITING_FOR_REQUESTER, CLOSED,
-- REOPENED, CANCELLED) WITHOUT removing PENDING, creates User/PublicComment/
-- InternalNote tables, adds Ticket.requesterUserId + problemAppearsResolvedAt,
-- and backfills Users + Ticket.requesterUserId. PENDING backfill + drop happens
-- in step 2/2 after these new enum values are committed (Postgres requires new
-- enum values to be committed before they can be used in the same transaction).
--
-- User backfill (runs below, after User table creation):
--   INSERT one User per existing Requester: role='REQUESTER', isActive copied,
--   mustChangePassword=true, legacyRequesterId=Requester.id,
--   passwordHash=<temporary scrypt placeholder of local-dev `Password123!`>.
--   Placeholder (BR-08 params N=16384,r=8,p=1,keyLen=64,16-byte salt, local-dev-only):
--   scrypt$N=16384,r=8,p=1$180b9b1d59138a1c82bb3e8e52116efd$49de6af90ef0b007896798e78f6b33e33acd4dff8b319b04c8b7db762c2d2a15c99607c18435cd8601aaed7279877e58a0370ab0576f9299247d652cfefff262
--   Seed later upserts same users by normalized email with fresh salts.
-- Ticket.requesterUserId backfill:
--   UPDATE "Ticket" SET "requesterUserId"="User"."id" FROM "User"
--   WHERE "User"."legacyRequesterId"="Ticket"."requesterId".
-- Existing Ticket/Attachment rows otherwise untouched.
-- FK ON DELETE: requesterId RESTRICT (unchanged), requesterUserId RESTRICT
-- (never cascade-delete tickets), ticketOwnerId SET NULL, legacyRequesterId
-- SET NULL, comment/note ticketId CASCADE, authorId RESTRICT (BR-22).
-- No DROP of data-bearing columns.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "problemAppearsResolvedAt" TIMESTAMP(3),
ADD COLUMN     "requesterUserId" INTEGER;

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "legacyRequesterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyRequesterId_key" ON "User"("legacyRequesterId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_mustChangePassword_idx" ON "User"("mustChangePassword");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "PublicComment_ticketId_idx" ON "PublicComment"("ticketId");

-- CreateIndex
CREATE INDEX "PublicComment_authorId_idx" ON "PublicComment"("authorId");

-- CreateIndex
CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalNote_ticketId_idx" ON "InternalNote"("ticketId");

-- CreateIndex
CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId");

-- CreateIndex
CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_requesterUserId_idx" ON "Ticket"("requesterUserId");

-- CreateIndex
CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- Backfill: create one User per existing Requester (reference strategy, spec §8).
-- Temporary local-dev credential = scrypt(BR-08) of `Password123!`; mustChangePassword=true forces rotation.
INSERT INTO "User" ("name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "legacyRequesterId", "createdAt", "updatedAt")
SELECT "name", "email", 'scrypt$N=16384,r=8,p=1$180b9b1d59138a1c82bb3e8e52116efd$49de6af90ef0b007896798e78f6b33e33acd4dff8b319b04c8b7db762c2d2a15c99607c18435cd8601aaed7279877e58a0370ab0576f9299247d652cfefff262', 'REQUESTER'::"Role", "isActive", true, "id", NOW(), NOW()
FROM "Requester"
ON CONFLICT ("email") DO NOTHING;

-- Backfill: Ticket.requesterUserId from Ticket.requesterId via User.legacyRequesterId (spec §8).
UPDATE "Ticket" SET "requesterUserId" = "User"."id" FROM "User" WHERE "User"."legacyRequesterId" = "Ticket"."requesterId";

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_legacyRequesterId_fkey" FOREIGN KEY ("legacyRequesterId") REFERENCES "Requester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketOwnerId_fkey" FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
