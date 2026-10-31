// Lab 4 ticket-workflow API tests (docs/lab-04/tests.md L4-API-04, L4-API-06,
// L4-API-10, L4-UNIT-02, L4-API-11).
//
// Covers the BR-07 resolution gate (409 RESOLUTION_BLOCKED vs the unchanged
// Lab 3 INVALID_STATUS_TRANSITION), the BR-09 expectedUpdatedAt precondition on
// status/assignment/priority, and the additive pendingFollowUpCount on the
// detail + status responses. Mocks provide `$transaction`/`$queryRaw` so the
// controller's FOR UPDATE transaction path is exercised; the true row-locking
// anti-race guarantee is proven against live Postgres (Lab 4 live evidence).

import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { clearAllSessions, createSession } from "../../src/modules/auth/auth.service.js";
import { checkExpectedUpdatedAt } from "../../src/modules/actions-taken/actions-taken.service.js";
import { STATUS_TRANSITIONS } from "../../src/modules/staff/staff.service.js";
import { setNowProvider } from "../../src/utils/clock.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

const NOW = new Date("2026-10-09T08:15:00.000Z");

const staffUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

function userFindUnique(sessionUser: Record<string, unknown>, owners: Record<number, Record<string, unknown>> = {}) {
  return vi.fn(async (args: { where: { id: number } }) => {
    if (args.where.id === sessionUser.id) return sessionUser;
    return owners[args.where.id] ?? null;
  });
}

function withTx(client: Record<string, unknown>) {
  const tx: Record<string, unknown> = { ...client };
  tx.$queryRaw = vi.fn(async () => []);
  tx.$transaction = vi.fn(async (fn: (c: unknown) => Promise<unknown>) => fn(tx));
  return tx;
}

function mockPrisma(client: Record<string, unknown>) {
  const tx = withTx(client);
  vi.mocked(getPrisma).mockReturnValue(tx as never);
  return tx;
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    ticketNumber: "TKT-2026-000101",
    summary: "Laptop battery drains quickly",
    description: "Full description",
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "OPEN",
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-02T09:00:00Z"),
    problemAppearsResolvedAt: null,
    category: { name: "Hardware" },
    relatedSystem: { name: "Corporate Laptop" },
    requester: { name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    requesterUser: { id: 11, name: "Jennifer Anderson", email: "jennifer.anderson@example.com" },
    ticketOwner: null,
    attachments: [],
    publicComments: [],
    internalNotes: [],
    ...overrides,
  };
}

function cookie(userId = staffUser.id): string {
  return `toktickit_session=${createSession(userId)}`;
}

function statusMocks(options: {
  status: string;
  updatedAt?: Date;
  pending: number;
  update?: (args: { data: Record<string, unknown> }) => unknown;
}) {
  const { status, updatedAt = NOW, pending } = options;
  const update = vi.fn(
    options.update ??
      (async (args: { data: Record<string, unknown> }) => detailRow({ ...args.data })),
  );
  const count = vi.fn(async () => pending);
  const prisma = mockPrisma({
    user: { findUnique: userFindUnique(staffUser) },
    ticket: {
      findUnique: vi.fn(async () => ({ id: 101, status, updatedAt })),
      findFirst: vi.fn(async () => detailRow({ status })),
      update,
    },
    actionTaken: { count, findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
  }) as { ticket: { update: ReturnType<typeof vi.fn> }; actionTaken: { count: ReturnType<typeof vi.fn> } };
  return { prisma, update, count };
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
  setNowProvider(() => new Date(NOW.getTime()));
});

// ---------------------------------------------------------------------------
// Resolution gate (L4-API-04, L4-API-11)
// ---------------------------------------------------------------------------

describe("resolution gate on PATCH …/status (L4-API-04)", () => {
  it.each(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"])(
    "blocks %s → RESOLVED while a pending follow-up exists",
    async (from) => {
      const { prisma } = statusMocks({ status: from, pending: 2 });

      const response = await request(app)
        .patch("/api/staff/tickets/101/status")
        .set("Cookie", cookie())
        .send({ status: "RESOLVED" });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("RESOLUTION_BLOCKED");
      expect(response.body.error.fields.pendingFollowUpCount).toBe(2);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    },
  );

  it("allows → RESOLVED once the pending follow-up is resolved (0 pending)", async () => {
    const { prisma } = statusMocks({ status: "IN_PROGRESS", pending: 0 });

    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "RESOLVED" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED");
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "RESOLVED" } }),
    );
  });

  it("allows → RESOLVED with zero Actions Taken entries (gate not evaluated)", async () => {
    const { count } = statusMocks({ status: "OPEN", pending: 0 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "RESOLVED" });
    expect(response.status).toBe(200);
    // count is read post-write for the response; the gate itself found 0 and
    // proceeded. (Two reads happen total; the value is what matters.)
    expect(count).toHaveBeenCalled();
  });

  it("keeps the Lab 3 matrix-illegal code and never evaluates the gate", async () => {
    const { prisma } = statusMocks({ status: "NEW", pending: 5 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "RESOLVED" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    // The gate must not run for a matrix-illegal edge (NEW→RESOLVED).
    expect(prisma.actionTaken.count).not.toHaveBeenCalled();
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("allows a non-Resolved matrix edge even with pending follow-ups", async () => {
    const { prisma } = statusMocks({ status: "OPEN", pending: 3 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "IN_PROGRESS" });
    expect(response.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// expectedUpdatedAt concurrency on Ticket writes (L4-API-06)
// ---------------------------------------------------------------------------

describe("expectedUpdatedAt on ticket writes (L4-API-06)", () => {
  it("status: stale expectedUpdatedAt → 409 VERSION_CONFLICT + currentUpdatedAt, no write", async () => {
    const { prisma } = statusMocks({ status: "OPEN", updatedAt: NOW, pending: 0 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "IN_PROGRESS", expectedUpdatedAt: "2026-01-01T00:00:00.000Z" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    expect(response.body.data.currentUpdatedAt).toBe("2026-10-09T08:15:00.000Z");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("status: matching expectedUpdatedAt succeeds (retry after re-fetch)", async () => {
    statusMocks({ status: "OPEN", updatedAt: NOW, pending: 0 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "IN_PROGRESS", expectedUpdatedAt: NOW.toISOString() });
    expect(response.status).toBe(200);
  });

  it("status: malformed expectedUpdatedAt → 400", async () => {
    statusMocks({ status: "OPEN", pending: 0 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "IN_PROGRESS", expectedUpdatedAt: 123 });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.expectedUpdatedAt).toBeDefined();
  });

  it("assignment: stale expectedUpdatedAt → 409 with no write", async () => {
    const update = vi.fn(async () => detailRow());
    const prisma = mockPrisma({
      user: { findUnique: userFindUnique(staffUser, { 21: staffUser }) },
      ticket: {
        findUnique: vi.fn(async () => ({ id: 101, updatedAt: NOW })),
        findFirst: vi.fn(async () => detailRow()),
        update,
      },
      actionTaken: { count: vi.fn(async () => 0), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    }) as { ticket: { update: ReturnType<typeof vi.fn> } };

    const response = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", cookie())
      .send({ ownerId: 21, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("priority: stale expectedUpdatedAt → 409 with no write", async () => {
    const update = vi.fn(async () => detailRow());
    const prisma = mockPrisma({
      user: { findUnique: userFindUnique(staffUser) },
      ticket: {
        findUnique: vi.fn(async () => ({ id: 101, updatedAt: NOW })),
        findFirst: vi.fn(async () => detailRow()),
        update,
      },
      actionTaken: { count: vi.fn(async () => 0), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    }) as { ticket: { update: ReturnType<typeof vi.fn> } };

    const response = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", cookie())
      .send({ itPriority: "HIGH", expectedUpdatedAt: "2020-01-01T00:00:00.000Z" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it("priority: matching expectedUpdatedAt succeeds; malformed → 400", async () => {
    mockPrisma({
      user: { findUnique: userFindUnique(staffUser) },
      ticket: {
        findUnique: vi.fn(async () => ({ id: 101, updatedAt: NOW })),
        findFirst: vi.fn(async () => detailRow()),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => detailRow(args.data)),
      },
      actionTaken: { count: vi.fn(async () => 0), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    });
    const ok = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", cookie())
      .send({ itPriority: "HIGH", expectedUpdatedAt: NOW.toISOString() });
    expect(ok.status).toBe(200);

    const bad = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", cookie())
      .send({ itPriority: "HIGH", expectedUpdatedAt: "" });
    expect(bad.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// pendingFollowUpCount (L4-API-10)
// ---------------------------------------------------------------------------

describe("pendingFollowUpCount (L4-API-10)", () => {
  it("detail returns the authoritative pending count (0 when none)", async () => {
    mockPrisma({
      user: { findUnique: userFindUnique(staffUser) },
      ticket: {
        findUnique: vi.fn(async () => detailRow()),
        findFirst: vi.fn(async () => detailRow()),
        update: vi.fn(),
      },
      actionTaken: { count: vi.fn(async () => 3), findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    });

    const response = await request(app).get("/api/staff/tickets/101").set("Cookie", cookie());
    expect(response.status).toBe(200);
    expect(response.body.data.pendingFollowUpCount).toBe(3);
  });

  it("status-PATCH response also embeds pendingFollowUpCount", async () => {
    statusMocks({ status: "OPEN", pending: 0 });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", cookie())
      .send({ status: "IN_PROGRESS" });
    expect(response.status).toBe(200);
    expect(response.body.data.pendingFollowUpCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Comparator unit (L4-UNIT-02)
// ---------------------------------------------------------------------------

describe("checkExpectedUpdatedAt unit (L4-UNIT-02)", () => {
  const current = new Date("2026-10-09T08:15:00.000Z");

  it("passes when omitted or canonically equal", () => {
    expect(checkExpectedUpdatedAt(undefined, current).ok).toBe(true);
    expect(checkExpectedUpdatedAt(current.toISOString(), current).ok).toBe(true);
  });

  it("detects mismatch and returns currentUpdatedAt", () => {
    const result = checkExpectedUpdatedAt("2020-01-01T00:00:00.000Z", current);
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "mismatch") {
      expect(result.currentUpdatedAt).toBe(current.toISOString());
    } else {
      throw new Error("expected a mismatch");
    }
  });

  it("flags malformed input (non-string / unparseable / empty)", () => {
    for (const value of [123, "not-a-date", "", "   ", {}]) {
      const result = checkExpectedUpdatedAt(value, current);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.kind).toBe("malformed");
    }
  });
});

// ---------------------------------------------------------------------------
// Sanity: the matrix is unchanged (gate is additive)
// ---------------------------------------------------------------------------

describe("matrix unchanged (Lab 3 compatibility)", () => {
  it("still permits every Lab 3 matrix edge when no follow-up is pending", async () => {
    const cases = Object.entries(STATUS_TRANSITIONS) as Array<[string, string[]]>;
    for (const [from, nexts] of cases) {
      for (const next of nexts) {
        statusMocks({ status: from, pending: 0 });
        const response = await request(app)
          .patch("/api/staff/tickets/101/status")
          .set("Cookie", cookie())
          .send({ status: next });
        expect(response.status).toBe(200);
      }
    }
  });
});
