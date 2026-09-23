/**
 * Structural concurrency tests for the updateUser P2034 retry handler.
 *
 * These tests use the same mock infrastructure as users-admin.api.test.ts
 * (no real database required) and verify:
 *
 * 1. P2034 once → retry → HTTP 200 (not HTTP 500).
 * 2. P2034 every attempt → exhaust MAX_RETRIES → HTTP 500.
 * 3. Non-P2034 errors are NOT retried (exactly 1 $transaction call).
 * 4. Concurrent PATCH requests all resolve to 200 or domain 4xx, never 500 from P2034.
 * 5. Domain AppErrors (LAST_ADMIN / SELF_DEACTIVATION) do NOT trigger retry.
 *
 * The real-database equivalent (two Administrators deactivated simultaneously,
 * asserting the live outcome is 200/409 with at least one active admin left and
 * never HTTP 500) lives in tests/int/lab-03/users-admin.concurrency.int.test.ts
 * and runs via `npm run test:int`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));

const passwordHash = hashPassword("TokTickit1!");
const admin = {
  id: 1,
  name: "Admin",
  email: "admin@example.com",
  passwordHash,
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
  legacyRequesterId: null,
};
const managed = {
  ...admin,
  id: 9,
  email: "managed@example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const prisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn(),
};

const { app } = await import("../../src/app.js");

async function agentFor(user: typeof admin) {
  prisma.user.findUnique.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: user.email, password: "TokTickit1!" });
  prisma.user.findFirst.mockResolvedValue(user);
  return agent;
}

// Factory function — avoids creating a rejected Promise at module evaluation time
// which Vitest would report as an unhandled rejection before any test runs.
function makeP2034() {
  return Object.assign(new Error("Transaction conflict / Serialization failure"), { code: "P2034" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(prisma as never);
  prisma.user.findFirst.mockResolvedValue(admin);
  prisma.user.findUnique.mockResolvedValue({ id: 9, role: "IT_STAFF", isActive: true });
  prisma.user.count.mockResolvedValue(2);
  prisma.user.update.mockResolvedValue({ ...managed, id: 9, name: "Updated" });
});

describe("P2034 retry logic — concurrency structural tests", () => {
  it("retries once on P2034 and returns HTTP 200 on the second attempt", async () => {
    const agent = await agentFor(admin);

    let callCount = 0;
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => {
      callCount++;
      if (callCount === 1) throw makeP2034(); // First attempt fails
      return callback(prisma); // Second attempt succeeds
    });

    const response = await agent.patch("/api/admin/users/9").send({ name: "Updated" });

    expect(response.status).toBe(200);
    // 1 failure + 1 successful retry = exactly 2 calls
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("exhausts MAX_RETRIES on persistent P2034 and surfaces HTTP 500", async () => {
    const agent = await agentFor(admin);

    // Throw a fresh P2034 Error object each call to avoid Vitest shared-reference warnings.
    prisma.$transaction.mockImplementation(() => { throw makeP2034(); });

    const response = await agent.patch("/api/admin/users/9").send({ name: "WillFail" });

    expect(response.status).toBe(500);
    // MAX_RETRIES = 3 → 1 initial attempt + 3 retries = 4 total calls
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
  // Allow extra time: withRetry back-off is 50ms + 100ms + 200ms = 350ms total delay
  }, 15000);

  it("does NOT retry on non-P2034 errors — they surface immediately as HTTP 500", async () => {
    const agent = await agentFor(admin);

    // Throw synchronously so Vitest never sees an unhandled async rejection
    prisma.$transaction.mockImplementation(() => { throw Object.assign(new Error("Connection refused"), { code: "P1001" }); });

    const response = await agent.patch("/api/admin/users/9").send({ name: "WillFail" });

    expect(response.status).toBe(500);
    // Must NOT retry — exactly 1 $transaction call
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  }, 15000);


  it("concurrent PATCH requests all resolve to 200 or domain 4xx, never 500 from unhandled P2034", async () => {
    const agent = await agentFor(admin);

    let globalCallCount = 0;
    // Simulate a race condition: first few concurrent calls encounter P2034,
    // subsequent retries succeed. Each request retries independently.
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => {
      globalCallCount++;
      // Fail the very first call of each concurrent request to force at least one retry
      if (globalCallCount % 2 === 1 && globalCallCount <= 5) throw makeP2034();
      return callback(prisma);
    });

    // Fire 5 concurrent PATCH requests simulating real concurrency
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        agent.patch("/api/admin/users/9").send({ name: "Concurrent" }),
      ),
    );

    const statuses = results.map((r) => r.status);
    // Every response must be a known domain-level response — never 500 from P2034
    statuses.forEach((status) => {
      expect(
        [200, 400, 404, 409].includes(status),
        `Expected domain status (200/400/404/409) but got ${status}`,
      ).toBe(true);
    });
  });

  it("domain AppError (LAST_ADMIN) is NOT retried — still returns 409", async () => {
    const agent = await agentFor(admin);

    // Target is the last active Administrator
    prisma.user.findUnique.mockResolvedValue({ id: 9, role: "ADMINISTRATOR", isActive: true });
    prisma.user.count.mockResolvedValue(1);

    // Transaction itself succeeds (no P2034) but the business rule throws inside the callback
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );

    const response = await agent.patch("/api/admin/users/9").send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("LAST_ACTIVE_ADMIN");
    // AppErrors must NOT trigger withRetry — exactly 1 $transaction call
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("domain AppError (SELF_DEACTIVATION) is NOT retried — still returns 409", async () => {
    const agent = await agentFor(admin);

    // Target is the currently logged-in admin (id: 1)
    prisma.user.findUnique.mockResolvedValue({ id: 1, role: "ADMINISTRATOR", isActive: true });
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );

    const response = await agent.patch("/api/admin/users/1").send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SELF_DEACTIVATION");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
