-- Lab 4 migration: Actions Taken (spec §7 + Assumptions 7–12; BR-01…BR-09, BR-12).
-- Source of truth: docs/lab-04/specification.md §7 (Data Changes).
-- Strictly additive: creates the ActionTaken table + 3 indexes + 3 FKs and one
-- hand-written CHECK. Alters, backfills, renames, or drops NO Lab 1–3 table,
-- column, index, or enum value.
--
-- Legacy behavior (BR-07/BR-12): Tickets created in Labs 1–3 have zero
-- ActionTaken rows. The resolution-gate EXISTS query
-- (followUpRequired = TRUE AND followUpResolvedAt IS NULL) returns no rows for
-- them, so the gate does NOT block their OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER
-- → RESOLVED transitions (matrix rules alone apply). Dashboards count legacy
-- tickets normally (they are ordinary Ticket rows; zero-action tickets simply
-- contribute 0 to pendingFollowUp).
--
-- Hand-written CHECK (spec §7, BR-03): `result` stays a Prisma String (not a
-- native enum) so vocabulary growth is a data change, not an enum rewrite.
-- The CHECK below enforces the 5-value vocabulary at the DB layer (defense in
-- depth alongside service-layer validation). Prisma does not round-trip CHECK
-- constraints (`prisma migrate dev` / `db pull` may report drift on it) — this
-- is expected and MUST NOT be "fixed" by removing the constraint.
--
-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "followUpResolvedAt" TIMESTAMP(3),
    "followUpResolvedById" INTEGER,
    "attachmentNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_idx" ON "ActionTaken"("ticketId");

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_actionDate_idx" ON "ActionTaken"("ticketId", "actionDate");

-- CreateIndex
CREATE INDEX "ActionTaken_performedById_idx" ON "ActionTaken"("performedById");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_followUpResolvedById_fkey" FOREIGN KEY ("followUpResolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written CHECK per spec §7 (BR-03 controlled vocabulary, defense in depth).
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_result_check" CHECK ("result" IN ('RESOLVED_STEP', 'WORKAROUND', 'INFO_REQUESTED', 'ESCALATED', 'NO_FURTHER_ACTION'));
