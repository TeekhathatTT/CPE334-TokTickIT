import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { parseStaffQueueQuery } from "../../src/modules/staff/staff.service.js";
import { clearAllSessions, createSession } from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

// Authenticated IT Staff session (id 21). The authenticate middleware reads
// role/isActive/mustChangePassword from this row.
const staffUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

const requesterUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

function userFindUnique(user: typeof staffUser) {
  return vi.fn(async () => user);
}

function queueMocks(user: typeof staffUser = staffUser, ticket: Record<string, unknown> = {}) {
  return {
    user: { findUnique: userFindUnique(user) },
    ticket: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      ...ticket,
    },
  };
}

function staffCookie(userId = staffUser.id): string {
  return `toktickit_session=${createSession(userId)}`;
}

function sampleRow(id: number) {
  return {
    id,
    ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
    summary: `Laptop issue ${id}`,
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "NEW",
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-02T09:00:00Z"),
    category: { name: "Hardware" },
    requester: { name: "Jennifer Anderson" },
    ticketOwner: null,
  };
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("staff queue search and filters (AC-06)", () => {
  it("passes search into an OR across ticket/requester fields", async () => {
    const findMany = vi.fn(async () => [sampleRow(101)]);
    mockPrisma(queueMocks(staffUser, { count: vi.fn(async () => 1), findMany }));

    const response = await request(app)
      .get("/api/staff/tickets?search=laptop")
      .set("Cookie", staffCookie());

    expect(response.status).toBe(200);
    const where = findMany.mock.calls[0]![0].where as Record<string, unknown>;
    const or = where.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(7);
    expect(JSON.stringify(or)).toContain("laptop");
  });

  it("filters by repeated status values", async () => {
    const findMany = vi.fn(async () => []);
    mockPrisma(queueMocks(staffUser, { count: vi.fn(async () => 0), findMany }));

    const response = await request(app)
      .get("/api/staff/tickets?status=NEW&status=OPEN")
      .set("Cookie", staffCookie());

    expect(response.status).toBe(200);
    const where = findMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.status).toEqual({ in: ["NEW", "OPEN"] });
  });

  it("filters by priorities, category, and owner (including unassigned)", async () => {
    const findMany = vi.fn(async () => []);
    const count = vi.fn(async () => 0);

    mockPrisma(queueMocks(staffUser, { count, findMany }));
    const filtered = await request(app)
      .get("/api/staff/tickets?requestedPriority=HIGH&itPriority=LOW&categoryId=2&ownerId=21")
      .set("Cookie", staffCookie());
    expect(filtered.status).toBe(200);
    expect(findMany.mock.calls[0]![0].where).toMatchObject({
      requestedPriority: "HIGH",
      itPriority: "LOW",
      categoryId: 2,
      ticketOwnerId: 21,
    });

    mockPrisma(queueMocks(staffUser, { count, findMany: vi.fn(async () => []) }));
    const unassigned = await request(app)
      .get("/api/staff/tickets?ownerId=unassigned")
      .set("Cookie", staffCookie());
    expect(unassigned.status).toBe(200);
  });
});

describe("staff queue sorting and pagination (AC-06)", () => {
  it("defaults to updatedAt desc with stable id tiebreak", async () => {
    const findMany = vi.fn(async () => [sampleRow(1)]);
    mockPrisma(queueMocks(staffUser, { count: vi.fn(async () => 1), findMany }));

    const response = await request(app).get("/api/staff/tickets").set("Cookie", staffCookie());

    expect(response.status).toBe(200);
    const orderBy = findMany.mock.calls[0]![0].orderBy as Array<Record<string, unknown>>;
    expect(orderBy[0]).toEqual({ updatedAt: "desc" });
    expect(orderBy[orderBy.length - 1]).toEqual({ id: "desc" });
    expect(response.body.meta).toMatchObject({ page: 1, pageSize: 20, queueTotal: 1 });
  });

  it("honours explicit sort/order and page metadata", async () => {
    const findMany = vi.fn(async () => [sampleRow(1), sampleRow(2)]);
    mockPrisma(queueMocks(staffUser, { count: vi.fn(async () => 45), findMany }));

    const response = await request(app)
      .get("/api/staff/tickets?sort=status&order=asc&page=2&pageSize=10")
      .set("Cookie", staffCookie());

    expect(response.status).toBe(200);
    const args = findMany.mock.calls[0]![0];
    expect(args.orderBy[0]).toEqual({ status: "asc" });
    expect(args.skip).toBe(10);
    expect(args.take).toBe(10);
    expect(response.body.meta).toMatchObject({
      page: 2,
      pageSize: 10,
      totalItems: 45,
      totalPages: 5,
      queueTotal: 45,
      isEmpty: false,
      isNoResults: false,
    });
  });

  it("distinguishes empty queue from no-results", async () => {
    mockPrisma(queueMocks(staffUser, { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) }));
    const empty = await request(app).get("/api/staff/tickets").set("Cookie", staffCookie());
    expect(empty.body.meta).toMatchObject({ isEmpty: true, isNoResults: false, totalPages: 0 });

    mockPrisma(
      queueMocks(staffUser, {
        count: vi
          .fn()
          .mockResolvedValueOnce(7) // queueTotal: tickets exist
          .mockResolvedValueOnce(0), // totalItems: filters match none
        findMany: vi.fn(async () => []),
      }),
    );
    const noResults = await request(app)
      .get("/api/staff/tickets?status=CLOSED")
      .set("Cookie", staffCookie());
    expect(noResults.body.meta).toMatchObject({ isEmpty: false, isNoResults: true, queueTotal: 7 });
  });
});

describe("staff queue invalid query handling (AC-06)", () => {
  it.each([
    "/api/staff/tickets?sort=bogus",
    "/api/staff/tickets?order=sideways",
    "/api/staff/tickets?page=0",
    "/api/staff/tickets?pageSize=25",
    "/api/staff/tickets?status=PENDING",
    "/api/staff/tickets?status=NEW,BOGUS",
    "/api/staff/tickets?requestedPriority=URGENT",
    "/api/staff/tickets?categoryId=abc",
    "/api/staff/tickets?ownerId=abc",
    "/api/staff/tickets?search=" + "x".repeat(121),
  ])("returns 400 with fields for %s", async (path) => {
    mockPrisma(queueMocks());
    const response = await request(app).get(path).set("Cookie", staffCookie());
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toBeDefined();
  });
});

describe("staff queue authorization", () => {
  it("returns 403 for a Requester role and 401 without a session", async () => {
    mockPrisma(queueMocks(requesterUser));

    const forbidden = await request(app)
      .get("/api/staff/tickets")
      .set("Cookie", `toktickit_session=${createSession(requesterUser.id)}`);
    expect(forbidden.status).toBe(403);

    const unauthenticated = await request(app).get("/api/staff/tickets");
    expect(unauthenticated.status).toBe(401);
  });
});

describe("queue query parser unit", () => {
  it("rejects legacy PENDING with a migration hint", () => {
    const parsed = parseStaffQueueQuery({ status: "PENDING" });
    expect(parsed.ok).toBe(false);
    expect(parsed.fields?.status).toMatch(/migrated/i);
  });
});
