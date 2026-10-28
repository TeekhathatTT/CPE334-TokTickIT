// Lab 4 Actions Taken API integration tests (docs/lab-04/tests.md
// L4-API-01/02/03/06, L4-AUTHZ-01/02).
//
// These mock `getPrisma()` but provide `$transaction`/`$queryRaw` so the real
// controller transaction path (with the BR-07 lock) is exercised; the actual
// row-locking anti-race behavior is additionally proven against live Postgres
// (see the Lab 4 live-check evidence in the PR). The injectable app clock is
// frozen per BR-14 so `actionDate`/`followUpResolvedAt` assertions are exact.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { clearAllSessions, createSession } from "../../src/modules/auth/auth.service.js";
import { setNowProvider } from "../../src/utils/clock.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

const NOW = new Date("2026-10-09T08:15:00.000Z");

interface TestUser {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  legacyRequesterId?: number | null;
}

const authorStaff: TestUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  legacyRequesterId: null,
};

const otherStaff: TestUser = {
  id: 22,
  name: "Tom Nguyen",
  email: "tom.nguyen@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

const adminUser: TestUser = {
  id: 31,
  name: "Alice Admin",
  email: "alice.admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
};

const requesterUser: TestUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  legacyRequesterId: 501,
};

// The session-user lookup branches on the queried id so authenticate's lookup
// and the requester ownership lookup never collide.
function userFindUnique(sessionUser: TestUser, owners: Record<number, TestUser> = {}) {
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

function actionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    ticketId: 101,
    performedById: 21,
    actionDate: NOW,
    description: "Restarted the print spooler and re-ran the queued job.",
    result: "RESOLVED_STEP",
    followUpRequired: false,
    followUpNote: null,
    followUpResolvedAt: null,
    followUpResolvedById: null,
    attachmentNotes: null,
    updatedAt: NOW,
    performedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" },
    resolvedBy: null,
    ...overrides,
  };
}

function staffWith(row: Record<string, unknown>) {
  // Success-shaped PATCH mock: findUnique returns the stored row (select
  // ignored), update echoes stored + data minus server-owned extras.
  const update = vi.fn(async (args: { data: Record<string, unknown> }) => {
    const { followUpResolvedById, ...rest } = args.data;
    const resolvedBy =
      typeof followUpResolvedById === "number"
        ? { id: followUpResolvedById, name: "actor", role: "IT_STAFF" }
        : (row.resolvedBy ?? null);
    return { ...row, ...rest, updatedAt: NOW, resolvedBy };
  });
  return withTx({
    user: { findUnique: userFindUnique(authorStaff, { 22: otherStaff, 31: adminUser }) },
    ticket: {
      findUnique: vi.fn(async () => ({ id: 101, updatedAt: row.updatedAt ?? NOW })),
      findFirst: vi.fn(async () => ({ id: 101 })),
      update: vi.fn(),
    },
    actionTaken: {
      findUnique: vi.fn(async () => row),
      findMany: vi.fn(async () => [row]),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: 99,
        ...args.data,
        updatedAt: NOW,
        performedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" },
        resolvedBy: null,
      })),
      update,
    },
  });
}

function cookie(userId: number): string {
  return `toktickit_session=${createSession(userId)}`;
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
  setNowProvider(() => new Date(NOW.getTime()));
});

afterEach(() => {
  setNowProvider(null);
});

// ---------------------------------------------------------------------------
// POST (L4-API-01, L4-API-02)
// ---------------------------------------------------------------------------

describe("POST /api/staff/tickets/:id/actions-taken (L4-API-01/02)", () => {
  function createMocks(sessionUser: TestUser = authorStaff, ticket: Record<string, unknown> | null = { id: 101 }) {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: 99,
      ...args.data,
      updatedAt: NOW,
      performedBy: { id: sessionUser.id, name: sessionUser.name, role: sessionUser.role },
      resolvedBy: null,
    }));
    const prisma = mockPrisma({
      user: { findUnique: userFindUnique(sessionUser) },
      ticket: {
        findUnique: vi.fn(async () => ticket),
        findFirst: vi.fn(async () => ticket),
        update: vi.fn(),
      },
      actionTaken: {
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        create,
        update: vi.fn(),
      },
    }) as { actionTaken: { create: ReturnType<typeof vi.fn> } };
    return { prisma, create };
  }

  it("creates an entry: 201, server-set actionDate, session-derived performedBy", async () => {
    const { create } = createMocks(authorStaff);

    const response = await request(app)
      .post("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "Restarted the print spooler and re-ran the job.", result: "RESOLVED_STEP" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      ticketId: 101,
      actionDate: "2026-10-09T08:15:00.000Z",
      createdAt: "2026-10-09T08:15:00.000Z",
      result: "RESOLVED_STEP",
      followUpRequired: false,
      performedBy: { id: 21, role: "IT_STAFF" },
      resolvedBy: null,
    });
    expect(response.body.data.createdAt).toBe(response.body.data.actionDate);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ performedById: 21, actionDate: NOW, followUpRequired: false }),
      }),
    );
  });

  it("lets an Administrator create on any ticket", async () => {
    const { prisma } = createMocks(adminUser);
    const response = await request(app)
      .post("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(adminUser.id))
      .send({ description: "Adjusted the account lockout policy for this user.", result: "WORKAROUND" });
    expect(response.status).toBe(201);
    expect(prisma.actionTaken.create).toHaveBeenCalled();
  });

  it("returns 404 for a missing ticket", async () => {
    createMocks(authorStaff, null);
    const response = await request(app)
      .post("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "Restarted the print spooler and re-ran the job.", result: "RESOLVED_STEP" });
    expect(response.status).toBe(404);
  });

  it("rejects invalid bodies with 400 + fields and creates no row", async () => {
    const cases: Array<Record<string, unknown>> = [
      { description: "abc", result: "RESOLVED_STEP" },
      { description: "x".repeat(2001), result: "RESOLVED_STEP" },
      { description: "A valid description here", result: "BOGUS" },
      { description: "A valid description here", result: "RESOLVED_STEP", followUpRequired: true },
      { description: "A valid description here", result: "RESOLVED_STEP", followUpNote: "leftover note" },
      { description: "A valid description here", result: "RESOLVED_STEP", attachmentNotes: "y".repeat(501) },
    ];
    for (const body of cases) {
      const { prisma } = createMocks(authorStaff);
      const response = await request(app)
        .post("/api/staff/tickets/101/actions-taken")
        .set("Cookie", cookie(authorStaff.id))
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields).toBeDefined();
      expect(prisma.actionTaken.create).not.toHaveBeenCalled();
    }
  });

  it("requires followUpNote when followUpRequired is true", async () => {
    const { prisma } = createMocks(authorStaff);
    const response = await request(app)
      .post("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "A valid description here", result: "INFO_REQUESTED", followUpRequired: true, followUpNote: "ok" });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpNote).toBeDefined();
    expect(prisma.actionTaken.create).not.toHaveBeenCalled();
  });

  it("strictly rejects server-owned fields (never honored, never ignored)", async () => {
    for (const field of ["actionDate", "performedById", "followUpResolvedAt", "followUpResolvedById"]) {
      const { prisma } = createMocks(authorStaff);
      const response = await request(app)
        .post("/api/staff/tickets/101/actions-taken")
        .set("Cookie", cookie(authorStaff.id))
        .send({ description: "A valid description here", result: "RESOLVED_STEP", [field]: null });
      expect(response.status).toBe(400);
      expect(response.body.error.fields[field]).toBeDefined();
      expect(prisma.actionTaken.create).not.toHaveBeenCalled();
    }
  });

  it("returns 403 for a Requester", async () => {
    createMocks(requesterUser);
    const response = await request(app)
      .post("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(requesterUser.id))
      .send({ description: "A valid description here", result: "RESOLVED_STEP" });
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET lists (L4-API-01/02, L4-AUTHZ-01)
// ---------------------------------------------------------------------------

describe("GET actions taken (L4-AUTHZ-01)", () => {
  it("lists staff entries chronologically with the full shape", async () => {
    const rows = [actionRow({ id: 1 }), actionRow({ id: 2, followUpRequired: true, followUpNote: "follow up" })];
    mockPrisma({
      user: { findUnique: userFindUnique(authorStaff) },
      ticket: {
        findUnique: vi.fn(async () => ({ id: 101 })),
        findFirst: vi.fn(async () => ({ id: 101 })),
        update: vi.fn(),
      },
      actionTaken: {
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => rows),
        create: vi.fn(),
        update: vi.fn(),
      },
    });

    const response = await request(app)
      .get("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[1]).toMatchObject({ followUpRequired: true, followUpNote: "follow up" });
  });

  it("returns an empty array (not 404) for a ticket with no entries", async () => {
    mockPrisma({
      user: { findUnique: userFindUnique(authorStaff) },
      ticket: { findUnique: vi.fn(async () => ({ id: 101 })), findFirst: vi.fn(async () => ({ id: 101 })), update: vi.fn() },
      actionTaken: { findUnique: vi.fn(), findMany: vi.fn(async () => []), create: vi.fn(), update: vi.fn() },
    });
    const response = await request(app)
      .get("/api/staff/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it("Requester sees their own ticket's entries and not another user's (404)", async () => {
    mockPrisma({
      user: { findUnique: userFindUnique(requesterUser) },
      ticket: {
        findUnique: vi.fn(async () => ({ id: 101 })),
        // Models ownership: the requester owns ticket 101 only.
        findFirst: vi.fn(async (args: { where: { id: number } }) =>
          args.where.id === 101 ? { id: 101 } : null,
        ),
        update: vi.fn(),
      },
      actionTaken: { findUnique: vi.fn(), findMany: vi.fn(async () => [actionRow()]), create: vi.fn(), update: vi.fn() },
    });

    const own = await request(app).get("/api/tickets/101/actions-taken").set("Cookie", cookie(requesterUser.id));
    expect(own.status).toBe(200);
    expect(own.body.data).toHaveLength(1);

    // A different ticket id that the ownership filter excludes → hidden 404.
    const excluded = await request(app).get("/api/tickets/999/actions-taken").set("Cookie", cookie(requesterUser.id));
    expect(excluded.status).toBe(404);
  });

  it("returns 403 when an IT Staff user calls the Requester route", async () => {
    mockPrisma({ user: { findUnique: userFindUnique(authorStaff) } });
    const response = await request(app)
      .get("/api/tickets/101/actions-taken")
      .set("Cookie", cookie(authorStaff.id));
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PATCH (L4-API-03)
// ---------------------------------------------------------------------------

describe("PATCH /api/staff/tickets/:id/actions-taken/:actionId (L4-API-03)", () => {
  function patched(body: Record<string, unknown>, options: {
    stored?: Record<string, unknown>;
    sessionUser?: TestUser;
  } = {}) {
    const stored = options.stored ?? actionRow();
    const sessionUser = options.sessionUser ?? authorStaff;
    const client = staffWith(stored);
    (client.user as { findUnique: ReturnType<typeof vi.fn> }).findUnique = userFindUnique(sessionUser, {
      22: otherStaff,
      31: adminUser,
    });
    mockPrisma(client);
    return request(app)
      .patch("/api/staff/tickets/101/actions-taken/12")
      .set("Cookie", cookie(sessionUser.id))
      .send(body);
  }

  it("author edits a correctable field (200, updatedAt bump)", async () => {
    const response = await patched({ description: "Restarted the print spooler and cleared the jam." });
    expect(response.status).toBe(200);
    expect(response.body.data.description).toBe("Restarted the print spooler and cleared the jam.");
  });

  it("non-author IT Staff field-only edit is 403 (no partial application)", async () => {
    const response = await patched({ description: "not mine to edit" }, { sessionUser: otherStaff });
    expect(response.status).toBe(403);
  });

  it("non-author mixed body (even with null field) is 403 as a whole", async () => {
    const response = await patched(
      { attachmentNotes: null, markFollowUpResolved: true },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note" }), sessionUser: otherStaff },
    );
    expect(response.status).toBe(403);
  });

  it("any staff can resolve-only a pending follow-up (200, getNow, resolvedBy)", async () => {
    const response = await patched(
      { markFollowUpResolved: true },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note" }), sessionUser: otherStaff },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.followUpResolvedAt).toBe("2026-10-09T08:15:00.000Z");
    expect(response.body.data.resolvedBy).toMatchObject({ id: 22 });
  });

  it("double-resolve is 409 FOLLOW_UP_ALREADY_RESOLVED", async () => {
    const response = await patched(
      { markFollowUpResolved: true },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note", followUpResolvedAt: NOW }) },
    );
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("FOLLOW_UP_ALREADY_RESOLVED");
  });

  it("resolving a merged-false flag is 400 (false + resolve in one call)", async () => {
    const response = await patched({ followUpRequired: false, markFollowUpResolved: true });
    expect(response.status).toBe(400);
  });

  it("rejects a non-boolean followUpRequired with 400 (never a flip)", async () => {
    const response = await patched({ followUpRequired: null });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.followUpRequired).toBeDefined();
  });

  it("T1: pending true→false is 400 (resolve first)", async () => {
    const response = await patched(
      { followUpRequired: false },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note" }) },
    );
    expect(response.status).toBe(400);
  });

  it("T2: resolved true→false preserves history (200)", async () => {
    const response = await patched(
      { followUpRequired: false },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note", followUpResolvedAt: NOW }) },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.followUpResolvedAt).toBe("2026-10-09T08:15:00.000Z");
  });

  it("T3: all-clear false→true needs a fresh note", async () => {
    const missing = await patched({ followUpRequired: true });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.followUpNote).toBeDefined();

    const supplied = await patched({ followUpRequired: true, followUpNote: "Confirm jam is cleared tomorrow." });
    expect(supplied.status).toBe(200);
    expect(supplied.body.data.followUpRequired).toBe(true);
  });

  it("T4: resolved false→true clears resolution with a fresh note", async () => {
    const response = await patched(
      { followUpRequired: true, followUpNote: "Re-armed: confirm with requester." },
      { stored: actionRow({ followUpRequired: false, followUpResolvedAt: NOW, followUpResolvedById: 21 }) },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.followUpResolvedAt).toBeNull();
  });

  it("field-only edit on a resolved row preserves resolution (no re-arm)", async () => {
    const response = await patched(
      { description: "Fixed a typo in this entry's description." },
      { stored: actionRow({ followUpRequired: true, followUpNote: "pending note", followUpResolvedAt: NOW }) },
    );
    expect(response.status).toBe(200);
    expect(response.body.data.followUpResolvedAt).toBe("2026-10-09T08:15:00.000Z");
  });

  it("followUpNote-only correction on a resolved row preserves resolution; null when merged-true is 400", async () => {
    const ok = await patched(
      { followUpNote: "Corrected wording for the requester." },
      { stored: actionRow({ followUpRequired: true, followUpNote: "old note", followUpResolvedAt: NOW }) },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.followUpResolvedAt).toBe("2026-10-09T08:15:00.000Z");

    const bad = await patched(
      { followUpNote: null },
      { stored: actionRow({ followUpRequired: true, followUpNote: "old note", followUpResolvedAt: NOW }) },
    );
    expect(bad.status).toBe(400);
  });

  it("rejects an empty body with 400", async () => {
    const response = await patched({});
    expect(response.status).toBe(400);
  });

  it("returns 404 when the entry does not belong to the ticket", async () => {
    const response = await patched(
      { description: "Fixed a typo in this entry's description." },
      { stored: actionRow({ ticketId: 202 }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns 403 for a Requester on the staff PATCH route", async () => {
    mockPrisma({ user: { findUnique: userFindUnique(requesterUser) } });
    const response = await request(app)
      .patch("/api/staff/tickets/101/actions-taken/12")
      .set("Cookie", cookie(requesterUser.id))
      .send({ markFollowUpResolved: true });
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Version concurrency on Actions Taken (L4-API-06)
// ---------------------------------------------------------------------------

describe("Actions Taken expectedUpdatedAt (L4-API-06)", () => {
  it("mismatch → 409 VERSION_CONFLICT (+currentUpdatedAt) with no write", async () => {
    const stored = actionRow({ updatedAt: new Date("2026-10-09T08:15:00.000Z") });
    const client = staffWith(stored);
    const prisma = mockPrisma(client) as { actionTaken: { update: ReturnType<typeof vi.fn> } };

    const response = await request(app)
      .patch("/api/staff/tickets/101/actions-taken/12")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "A newer edit attempt.", expectedUpdatedAt: "2026-10-08T00:00:00.000Z" });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("VERSION_CONFLICT");
    expect(response.body.data.currentUpdatedAt).toBe("2026-10-09T08:15:00.000Z");
    expect(prisma.actionTaken.update).not.toHaveBeenCalled();
  });

  it("matching expectedUpdatedAt succeeds", async () => {
    const stored = actionRow({ updatedAt: new Date("2026-10-09T08:15:00.000Z") });
    mockPrisma(staffWith(stored));
    const response = await request(app)
      .patch("/api/staff/tickets/101/actions-taken/12")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "A current edit attempt.", expectedUpdatedAt: "2026-10-09T08:15:00.000Z" });
    expect(response.status).toBe(200);
  });

  it("malformed expectedUpdatedAt → 400 (never silently ignored)", async () => {
    mockPrisma(staffWith(actionRow()));
    const response = await request(app)
      .patch("/api/staff/tickets/101/actions-taken/12")
      .set("Cookie", cookie(authorStaff.id))
      .send({ description: "A current edit attempt.", expectedUpdatedAt: "not-a-date" });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.expectedUpdatedAt).toBeDefined();
  });
});
