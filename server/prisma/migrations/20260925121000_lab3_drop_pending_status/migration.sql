-- Lab 3 migration step 2/2: backfill legacy PENDING → WAITING_FOR_REQUESTER and drop PENDING.
-- Spec source: docs/lab-03/specification.md §8 + BR-13 + Assumptions
--   "Legacy PENDING is migrated (not retained)".
-- Precondition: step 1/2 already added WAITING_FOR_REQUESTER/CLOSED/REOPENED/CANCELLED
-- and committed them, so the backfill target exists (Postgres requires new enum
-- values to be committed before use — hence the two-step split).
-- Steps (spec §8): (1) done in 1/2, (2) UPDATE below, (3) assert zero PENDING,
-- (4) recreate enum to exactly the 8 required values
-- (NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED).
-- After this, no row, response, filter, or transition references PENDING.
-- Existing Ticket/Attachment rows otherwise untouched.
-- DEPLOYMENT ORDERING (breaking change): this migration drops PENDING from the
-- DB enum and must only be applied together with / after the Lab 3 API + UI
-- changes are deployed. Lab 2 consumers (GET /api/tickets?status=PENDING filter,
-- PENDING option in MyTicketsPage, TicketStatus type) are updated in the same
-- release to the 8-value enum; legacy PENDING filter/status writes are rejected
-- with 400 VALIDATION_ERROR and PENDING never appears in responses. Do not run
-- this migration while old Lab 2 clients still depend on PENDING.

-- Step 2: backfill legacy PENDING → WAITING_FOR_REQUESTER (spec §8, BR-13).
UPDATE "Ticket" SET "status" = 'WAITING_FOR_REQUESTER'::"TicketStatus" WHERE "status" = 'PENDING'::"TicketStatus";

-- Step 3: assert zero PENDING rows remain before dropping the enum value.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "Ticket" WHERE "status"::text = 'PENDING') THEN RAISE EXCEPTION 'Migration blocked: PENDING rows remain after backfill'; END IF; END $$;

-- Step 4: recreate enum to exactly the 8 required values, dropping PENDING.
-- AlterEnum
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');
ALTER TABLE "public"."Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "public"."TicketStatus_old";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';
COMMIT;
