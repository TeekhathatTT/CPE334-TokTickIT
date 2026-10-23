// Lab 4 row-locking helpers (specification.md BR-07 "Atomicity").
//
// Every ticket write (status/assignment/priority) and every Actions Taken
// create/edit/resolve runs inside a transaction whose first statement locks the
// parent Ticket row (`SELECT 1 FROM "Ticket" WHERE id = $1 FOR UPDATE`). The
// lock serializes a concurrent resolver against a concurrent follow-up flagger
// so a ticket can never end up RESOLVED with a pending follow-up, and makes the
// `expectedUpdatedAt` check a real lost-update guard (post-lock re-read).
//
// Test doubles that mock `getPrisma()` without `$transaction` support fall back
// to running the work directly — the mocked-prisma unit tests cannot exercise
// row locking, which is exactly why the gate/conflict paths are additionally
// exercised against live Postgres (see the Lab 4 live-check evidence).

import { Prisma } from "@prisma/client";

export interface TransactionCapable {
  $transaction?: unknown;
  $queryRaw?: unknown;
}

/** Acquire a `FOR UPDATE` row lock on the parent Ticket inside a transaction. */
export async function lockTicketRow(tx: unknown, ticketId: number): Promise<void> {
  const client = tx as { $queryRaw?: (...args: unknown[]) => Promise<unknown> };
  if (typeof client.$queryRaw !== "function") return;
  await client.$queryRaw(
    Prisma.sql`SELECT 1 FROM "Ticket" WHERE id = ${ticketId} FOR UPDATE`,
  );
}

/** Acquire a `FOR UPDATE` row lock on one ActionTaken row inside a transaction. */
export async function lockActionRow(tx: unknown, actionId: number): Promise<void> {
  const client = tx as { $queryRaw?: (...args: unknown[]) => Promise<unknown> };
  if (typeof client.$queryRaw !== "function") return;
  await client.$queryRaw(
    Prisma.sql`SELECT 1 FROM "ActionTaken" WHERE id = ${actionId} FOR UPDATE`,
  );
}

/**
 * Run `work` inside a transaction that first locks the parent Ticket row.
 * When the provided client has no `$transaction` (a mocked test double), the
 * work runs against the client directly so existing mocked suites stay green.
 *
 * `$transaction` MUST be invoked as a method on the Prisma client (not a
 * detached reference) — the real client reads `this._engineConfig`, so an
 * unbound call throws. Mocked doubles hide this because their `$transaction`
 * is a plain function; the live-Postgres check catches it.
 */
export async function withTicketLock<T>(
  prisma: unknown,
  ticketId: number,
  work: (tx: unknown) => Promise<T>,
): Promise<T> {
  const capable = prisma as {
    $transaction?: (fn: (tx: unknown) => Promise<T>) => Promise<T>;
  };
  if (typeof capable.$transaction !== "function") {
    return work(prisma);
  }
  return capable.$transaction(async (tx) => {
    await lockTicketRow(tx, ticketId);
    return work(tx);
  });
}
