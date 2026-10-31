-- Lab 4 rollback for 20261014063908_lab4_actions_taken.
-- Removes exactly what the Lab 4 migration added, dependency-safe order
-- (CHECK + FKs, then indexes, then table, then the migration-history row).
-- Lab 1-3 objects are NOT touched.
-- Safe to re-run: every DROP is guarded by IF EXISTS, including the
-- ALTER TABLE statements (ALTER TABLE IF EXISTS), so a second run after the
-- table is gone succeeds instead of aborting the transaction.
-- Tested 2026-10-14 against local Postgres 16 (see docs/lab-04/migration-recovery.md §5).
-- Usage:
--   docker cp ./server/prisma/rollback/20261014063908_lab4_actions_taken.down.sql toktickit-db:/tmp/rollback_lab4.sql
--   docker exec toktickit-db psql -U toktickit -d toktickit -v ON_ERROR_STOP=1 --single-transaction -f /tmp/rollback_lab4.sql
-- NOTE: rolling back DISCARDS any ActionTaken rows created after the Lab 4
-- migration. The §2 backup is the only way to recover them — restore the dump
-- instead of rolling back if the rows must be kept.
BEGIN;
ALTER TABLE IF EXISTS "ActionTaken" DROP CONSTRAINT IF EXISTS "ActionTaken_result_check";
ALTER TABLE IF EXISTS "ActionTaken" DROP CONSTRAINT IF EXISTS "ActionTaken_followUpResolvedById_fkey";
ALTER TABLE IF EXISTS "ActionTaken" DROP CONSTRAINT IF EXISTS "ActionTaken_performedById_fkey";
ALTER TABLE IF EXISTS "ActionTaken" DROP CONSTRAINT IF EXISTS "ActionTaken_ticketId_fkey";
DROP INDEX IF EXISTS "ActionTaken_ticketId_actionDate_idx";
DROP INDEX IF EXISTS "ActionTaken_ticketId_idx";
DROP INDEX IF EXISTS "ActionTaken_performedById_idx";
DROP TABLE IF EXISTS "ActionTaken";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261014063908_lab4_actions_taken';
COMMIT;
