/**
 * Real-database integration test: two active Administrators are deactivated at
 * the same time against the running PostgreSQL database (NOT mocks).
 *
 * This complements the structural P2034-retry unit tests in
 * tests/lab-03/users-admin.concurrency.test.ts which cannot force a serialization
 * failure against a real database. Here the app's own /api/admin/users/:id PATCH
 * handler fires two genuine concurrent requests and we verify, from the real
 * outcome:
 *
 * 1. No HTTP 500 is returned. Any Prisma P2034 raised by the concurrent
 *    Serializable transactions must be retried by withRetry() and the request
 *    must resolve to a domain status (200 or 409).
 * 2. Every response is 200 or 409 (LAST_ACTIVE_ADMIN) — never 500, never an
 *    unexpected error code.
 * 3. At least one active Administrator remains in the database (the
 *    last-active-Administrator guard holds even under concurrency).
 *
 * Requires DATABASE_URL to point at a schema matching prisma/schema.prisma
 * (e.g. `npx prisma migrate reset --force` against the docker-compose database).
 * Runs via `npm run test:int` (see vitest.int.config.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { getPrisma } from "../../../src/prisma.js";
import { hashPassword } from "../../../src/auth.js";
import { app } from "../../../src/app.js";

const TEST_PASSWORD = "TokTickit1!";

describe("admin deactivation concurrency — real database", () => {
  const runId = `${Date.now()}-${process.pid}`;
  const actors: Array<{ id: number; email: string }> = [];

  let actorEmail = "";
  let targetAId = -1;
  let targetBId = -1;
  let restoredAdmins: Array<{ id: number }> = [];

  beforeAll(async () => {
    const prisma = getPrisma();
    const passwordHash = hashPassword(TEST_PASSWORD);
    const make = (label: string) =>
      prisma.user.create({
        data: {
          name: `Int Concurrency ${label}`,
          email: `int-${runId}-${label}@example.com`,
          passwordHash,
          role: "ADMINISTRATOR",
          isActive: true,
          mustChangePassword: false,
          legacyRequesterId: null,
        },
      });

    const actor = await make("actor");
    const targetA = await make("target-a");
    const targetB = await make("target-b");
    actors.push(actor, targetA, targetB);
    actorEmail = actor.email;
    targetAId = targetA.id;
    targetBId = targetB.id;

    // Temporarily deactivate every other active Administrator so that the only
    // active admins during the test are the actor + the two targets. They are
    // restored verbatim in afterAll.
    const others = await prisma.user.findMany({
      where: { role: "ADMINISTRATOR", isActive: true, email: { notIn: [actor.email, targetA.email, targetB.email] } },
      select: { id: true },
    });
    restoredAdmins = others;
    if (others.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: others.map((o) => o.id) } },
        data: { isActive: false },
      });
    }
  });

  afterAll(async () => {
    const prisma = getPrisma();
    if (restoredAdmins.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: restoredAdmins.map((o) => o.id) } },
        data: { isActive: true },
      });
    }
    await prisma.user.deleteMany({ where: { id: { in: actors.map((a) => a.id) } } });
    await prisma.$disconnect();
  });

  it("deactivating two admins simultaneously resolves to 200/409 (never 500) and leaves >=1 active admin", async () => {
    const prisma = getPrisma();
    const agent = request.agent(app);

    const login = await agent.post("/api/auth/login").send({ email: actorEmail, password: TEST_PASSWORD });
    expect(login.status).toBe(200);

    // Fire both deactivations at the same time — no sequencing between them.
    const responses = await Promise.all([
      agent.patch(`/api/admin/users/${targetAId}`).send({ isActive: false }),
      agent.patch(`/api/admin/users/${targetBId}`).send({ isActive: false }),
    ]);

    const statuses = responses.map((r) => r.status);
    statuses.forEach((status) => {
      expect([200, 409], `expected 200 or 409 but got HTTP ${status}`).toContain(status);
    });
    // Deactivating your own account is impossible from here, so any 409 must be
    // the last-active-Administrator guard.
    responses.forEach((r) => {
      if (r.status === 409) expect(r.body.error.code).toBe("LAST_ACTIVE_ADMIN");
    });

    // The requests really did reach the database: at least one target must be
    // inactive now.
    const deactivatedTargets = await prisma.user.count({
      where: { id: { in: [targetAId, targetBId] }, isActive: false },
    });
    expect(deactivatedTargets).toBeGreaterThanOrEqual(1);

    // The last-active-Administrator guard holds under concurrency: even after
    // both concurrent deactivations, at least one active Administrator remains.
    const activeAdmins = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
    expect(activeAdmins).toBeGreaterThanOrEqual(1);
  });
});