# Lab 4 Migration Recovery

Source of truth: `docs/lab-04/specification.md` §7 (Data Changes) + BR-07/BR-12.
Migration: `server/prisma/migrations/20261014063908_lab4_actions_taken/migration.sql`.
Scope: database evolution only — no routes, middleware, services, or React code.

Prisma has no down-migrations. This document gives the backup → manual-rollback →
restore procedure for the Lab 4 migration, plus the real test evidence that the
procedure leaves Lab 1–3 data byte-for-byte unchanged.

## 1. What the Lab 4 migration adds (and nothing else)

- Table `ActionTaken` (11 data columns + PK; `result` is `TEXT`, **not** a native
  enum — Assumption 12).
- 3 indexes: `ActionTaken_ticketId_idx`, `ActionTaken_ticketId_actionDate_idx`,
  `ActionTaken_performedById_idx` (plus the PK `ActionTaken_pkey`).
- 3 foreign keys: `ticketId → Ticket` (`ON DELETE CASCADE`),
  `performedById → User` (`ON DELETE RESTRICT`),
  `followUpResolvedById → User` (`ON DELETE SET NULL`).
- 1 hand-written `CHECK`: `ActionTaken_result_check`
  (`result IN ('RESOLVED_STEP','WORKAROUND','INFO_REQUESTED','ESCALATED','NO_FURTHER_ACTION')`,
  spec §7 / BR-03). Prisma does not round-trip `CHECK` constraints, so
  `prisma migrate dev` / `db pull` may report drift on it — expected, do not
  remove the constraint.
- 1 row in `_prisma_migrations` (`20261014063908_lab4_actions_taken`).

It alters, backfills, renames, or drops **no** Lab 1–3 table, column, index, or
enum value. Legacy behavior (BR-07/BR-12): Labs 1–3 tickets have zero
`ActionTaken` rows, so the resolution-gate `EXISTS` query returns no rows and
does not block their `→ RESOLVED` transitions; dashboards count them normally.

## 2. Backup before migrate

Run against the target database **before** applying the Lab 4 migration
(example: local dev DB at `127.0.0.1:5434`):

```sh
# Plain-SQL dump (restore with psql, §4). Inside the compose DB container:
docker exec toktickit-db pg_dump -U toktickit -d toktickit -Fp -f /tmp/lab4_before.sql
docker cp toktickit-db:/tmp/lab4_before.sql ./backups/lab4_before.sql

# Host-side equivalent (same DB, DATABASE_URL credential):
pg_dump "postgresql://toktickit:toktickit@127.0.0.1:5434/toktickit?schema=public" -Fp -f ./backups/lab4_before.sql
```

Record a baseline fingerprint (counts + checksums) before migrating:

```sh
cd server
# IMPORTANT: run the baseline seed from the lab4-staging base commit
# (d3a457c), NOT from this branch. This branch's seed upserts Kevin
# Thompson and then touches prisma.actionTaken, so on a pre-Lab-4 database
# (ActionTaken table not yet migrated) it fails part-way and leaves a dirty,
# half-seeded baseline (Kevin upserted, then crash at actionTaken).
git stash -u  # if needed to get a clean tree
git checkout lab4-staging  # or: git checkout d3a457c
node prisma/seed.mjs   # Lab 3 baseline seed (10 users, 8 tickets, 16 public comments, 6 internal notes)
# counts + md5(string_agg(... ORDER BY id)) per table; see §5 for the real numbers
git checkout feature/lab4-db-migration  # return to this branch afterwards
```

## 3. Manual rollback SQL (dependency-safe order)

Removes exactly what the Lab 4 migration added. Run inside a transaction;
safe to re-run (`IF EXISTS` guards):

```sql
-- Lab 4 rollback for 20261014063908_lab4_actions_taken.
-- Removes exactly what the Lab 4 migration added, dependency-safe order
-- (CHECK + FKs, then indexes, then table, then the migration-history row).
-- Lab 1–3 objects are NOT touched.
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
```

Apply with the versioned script (the exact file tested in §5):

```sh
docker cp ./server/prisma/rollback/20261014063908_lab4_actions_taken.down.sql toktickit-db:/tmp/rollback_lab4.sql
docker exec toktickit-db psql -U toktickit -d toktickit -v ON_ERROR_STOP=1 --single-transaction -f /tmp/rollback_lab4.sql
```

After rollback, `npx prisma migrate status` reports the database at
`20260925121000_lab3_drop_pending_status` (5 Lab 3 migrations) and the schema
matches the pre-Lab-4 state. Re-applying Lab 4 later is a normal
`npx prisma migrate deploy`.

> Note: rolling back **discards** any `ActionTaken` rows created after the Lab 4
> migration (there is no way to drop the table and keep its rows). The backup
> in §2 is the only way to recover them — restore the dump (§4) instead of
> rolling back if the rows must be kept.

## 4. Restore path (from the §2 dump)

In-place restore of the pre-migration dump into the same database (what §5
actually ran — not a side database):

```sh
# Connect to the maintenance `postgres` database: Postgres cannot DROP the
# database you are currently connected to.
docker exec toktickit-db psql -U toktickit -d postgres -c 'DROP DATABASE IF EXISTS toktickit WITH (FORCE);'
docker exec toktickit-db psql -U toktickit -d postgres -c 'CREATE DATABASE toktickit;'
docker cp ./backups/lab4_before.sql toktickit-db:/tmp/lab4_before.sql
docker exec toktickit-db psql -U toktickit -d toktickit -v ON_ERROR_STOP=1 --single-transaction -f /tmp/lab4_before.sql
# Verify counts + checksums equal the §5 baseline, then run
# `npx prisma migrate deploy` to re-apply Lab 4.
```

(`-v ON_ERROR_STOP=1 --single-transaction` makes any restore error abort the
whole reload instead of letting a partial restore silently pass.)

## 5. Test evidence (real run, 2026-10-14, local Postgres 16 via compose `db`)

Scratch database `toktickit_recovery` on `127.0.0.1:5434`:

1. Applied the 5 Lab 3 migrations (`npx prisma migrate deploy`) + ran the Lab 3
   seed (`node prisma/seed.mjs` → 10 users, 8 tickets, 16 public comments,
   6 internal notes).
2. Recorded baseline counts + checksums per table with the exact query below
   (`ORDER BY id` makes row order deterministic — without it a restore with
   identical data can yield a different checksum).

   Exact fingerprint query (run once per table; substitute the table name for
   `"User"` — `"User"`, `"Requester"`, `"Category"`, `"RelatedSystem"`,
   `"Ticket"`, `"Attachment"`, `"PublicComment"`, `"InternalNote"`):

   ```sql
   SELECT count(*) AS n,
          md5(coalesce(string_agg(t::text, ',' ORDER BY id), '')) AS checksum
   FROM "User" t;
   ```

   (`coalesce(..., '')` keeps the empty-table case (`Attachment`, 0 rows)
   at `md5('') = d41d8cd98f00b204e9800998ecf8427e` instead of `NULL`.)
3. `pg_dump -Fp` to `/tmp/lab4_before.sql` (32,198 bytes).
4. Applied the Lab 4 migration (`npx prisma migrate deploy` → 6 migrations).
   Verified: `ActionTaken_result_check` exists, 3 custom indexes exist,
   invalid `result = 'BOGUS_VALUE'` is rejected with
   `violates check constraint "ActionTaken_result_check"`.
5. Ran the §3 rollback SQL → `ALTER TABLE ×4, DROP INDEX ×3, DROP TABLE, DELETE 1`.
6. Drop + recreate + `psql -v ON_ERROR_STOP=1 --single-transaction -f /tmp/lab4_before.sql`
   restore (in-place, per §4) → checksums match baseline again.

### Before Lab 4 (baseline) vs after rollback — identical

| Table | Baseline count | Baseline checksum | After-rollback count | After-rollback checksum |
|---|---|---|---|---|
| User | 10 | eb756e4ea1ea5ac6f29cc3edd44d7f0b | 10 | eb756e4ea1ea5ac6f29cc3edd44d7f0b |
| Requester | 5 | 698a7f257ae5b82a809e66a7a9f8f7cc | 5 | 698a7f257ae5b82a809e66a7a9f8f7cc |
| Category | 4 | 6c2f2114d77ef0e7f7183b5c4f74c361 | 4 | 6c2f2114d77ef0e7f7183b5c4f74c361 |
| RelatedSystem | 5 | 2d2dd7c413f94cf13fd7daa791fe16af | 5 | 2d2dd7c413f94cf13fd7daa791fe16af |
| Ticket | 8 | a319933b1ef517a9f7c806bbd912bb30 | 8 | a319933b1ef517a9f7c806bbd912bb30 |
| Attachment | 0 | d41d8cd98f00b204e9800998ecf8427e | 0 | d41d8cd98f00b204e9800998ecf8427e |
| PublicComment | 16 | bc063c74782ad4c05c7af36ec561a881 | 16 | bc063c74782ad4c05c7af36ec561a881 |
| InternalNote | 6 | 7f74ab2a5240c538b685076089b8d9bd | 6 | 7f74ab2a5240c538b685076089b8d9bd |

- `_prisma_migrations` after rollback: exactly the 5 Lab 3 migrations
  (`…_init`, `…_add_requester`, `…_add_ticketing_core`,
  `…_lab3_users_roles_comments_notes`, `…_lab3_drop_pending_status`);
  `ActionTaken` table absent.
- Restore-path check after `DROP DATABASE` + `CREATE DATABASE` + reload of
  `lab4_before.sql`: counts + checksums identical to the baseline column above;
  `_prisma_migrations` back to the same 5 Lab 3 rows.

### Pre-existing drift note (not caused by this branch)

The dev database at apply time reported
`The migration 20260925121000_lab3_drop_pending_status was modified after it was
applied`. Cause: commit `fe7b18f` ("update db") appended a comment-only
`DEPLOYMENT ORDERING` block to that already-applied migration file — no SQL
semantics changed. This branch does **not** edit any Lab 1–3 migration. The
recovery test above used a fresh database (clean apply of the current files),
so its checksums are unaffected by that history.
