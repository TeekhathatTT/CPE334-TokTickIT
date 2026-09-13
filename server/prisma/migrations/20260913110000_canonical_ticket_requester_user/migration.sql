ALTER TABLE "Ticket" ADD COLUMN "requesterUserId" INTEGER;

UPDATE "Ticket" AS t
SET "requesterUserId" = u."id"
FROM "User" AS u
WHERE u."legacyRequesterId" = t."requesterId";

ALTER TABLE "Ticket" ALTER COLUMN "requesterUserId" SET NOT NULL;
CREATE INDEX "Ticket_requesterUserId_idx" ON "Ticket"("requesterUserId");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
