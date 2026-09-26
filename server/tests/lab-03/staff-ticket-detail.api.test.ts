import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { STATUS_TRANSITIONS } from "../../src/modules/staff/staff.service.js";
import { clearAllSessions, createSession } from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

const staffUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

const otherStaff = { id: 22, name: "Tom Nguyen", email: "tom.nguyen@example.com", role: "IT_STAFF", isActive: true };
const adminUser = { id: 31, name: "Alice Admin", email: "alice.admin@example.com", role: "ADMINISTRATOR", isActive: true };
const inactiveStaff = { id: 23, name: "Mark Lee", email: "mark.lee@example.com", role: "IT_STAFF", isActive: false };
const requesterAsOwner = { id: 11, name: "Jennifer Anderson", email: "jennifer.anderson@example.com", role: "REQUESTER", isActive: true };

const requesterSessionUser = { ...requesterAsOwner, mustChangePassword: false };

// Session-user lookup branches on the queried id so owner-eligibility
// fixtures never leak into the authenticate middleware path (and vice
// versa). Unknown ids return null like a real database would.
function userFindUnique(sessionUser: Record<string, unknown>, owners: Record<number, Record<string, unknown>>) {
  return vi.fn(async (args: { where: { id: number } }) => {
    if (args.where.id === sessionUser.id) return sessionUser;
    return owners[args.where.id] ?? null;
  });
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

function staffMocks(options: {
  sessionUser?: Record<string, unknown>;
  owners?: Record<number, Record<string, unknown>>;
  ticket?: Record<string, unknown> | null;
  update?: (args: { data: Record<string, unknown> }) => unknown;
} = {}) {
  const { sessionUser = staffUser, owners = {}, ticket = detailRow(), update } = options;
  return {
    user: { findUnique: userFindUnique(sessionUser, owners) },
    ticket: {
      findUnique: vi.fn(async () => ticket),
      findFirst: vi.fn(async () => ticket),
      update: vi.fn(async (args: { where: { id: number }; data: Record<string, unknown> }) =>
        detailRow({ ...(ticket as Record<string, unknown>), ...args.data }),
      ),
      ...(update ? { update: vi.fn(update) } : {}),
    },
  };
}

function staffCookie(userId = staffUser.id): string {
  return `toktickit_session=${createSession(userId)}`;
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("staff ticket detail (AC-07, AC-08)", () => {
  it("returns operational detail with permitted next statuses", async () => {
    mockPrisma(staffMocks({ ticket: detailRow({ status: "OPEN", problemAppearsResolvedAt: new Date("2026-09-03T10:00:00Z") }) }));

    const response = await request(app).get("/api/staff/tickets/101").set("Cookie", staffCookie());

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      ticketNumber: "TKT-2026-000101",
      status: "OPEN",
      problemAppearsResolvedAt: "2026-09-03T10:00:00.000Z",
    });
    expect(response.body.data.requester.email).toBe("jennifer.anderson@example.com");
    expect(response.body.data.permittedActions.allowedStatuses).toEqual(
      expect.arrayContaining(["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]),
    );
  });

  it("returns 404 for a missing ticket and 403 for a Requester", async () => {
    mockPrisma(staffMocks({ ticket: null }));
    const missing = await request(app).get("/api/staff/tickets/9999").set("Cookie", staffCookie());
    expect(missing.status).toBe(404);

    mockPrisma(staffMocks({ sessionUser: requesterSessionUser }));
    const forbidden = await request(app)
      .get("/api/staff/tickets/101")
      .set("Cookie", `toktickit_session=${createSession(requesterSessionUser.id)}`);
    expect(forbidden.status).toBe(403);
  });
});

describe("claim and reassign (AC-07, BR-11/BR-16)", () => {
  function assignMocks() {
    return staffMocks({
      owners: { 21: staffUser, 22: otherStaff, 31: adminUser, 23: inactiveStaff, 11: requesterAsOwner },
    });
  }

  it("claims (self-assigns) and unassigns", async () => {
    const update = vi.fn(async (args: { data: Record<string, unknown> }) => detailRow(args.data));
    mockPrisma({ ...assignMocks(), ticket: { findUnique: vi.fn(async () => ({ id: 101 })), update } });

    const claimed = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", staffCookie())
      .send({ ownerId: 21 });
    expect(claimed.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketOwnerId: 21 } }));

    const unassigned = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", staffCookie())
      .send({ ownerId: null });
    expect(unassigned.status).toBe(200);
  });

  it("reassigns to another active IT Staff user", async () => {
    const update = vi.fn(async (args: { data: Record<string, unknown> }) =>
      detailRow({ ticketOwnerId: args.data.ticketOwnerId, ticketOwner: { id: 22, name: "Tom Nguyen" } }),
    );
    mockPrisma({
      ...assignMocks(),
      ticket: { findUnique: vi.fn(async () => ({ id: 101 })), update },
    });
    const response = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", staffCookie())
      .send({ ownerId: 22 });
    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { ticketOwnerId: 22 } }));
    expect(response.body.data.owner).toMatchObject({ id: 22 });
  });

  it("rejects Administrators, Requesters, and inactive users with 400", async () => {
    for (const ownerId of [31, 11, 23]) {
      mockPrisma(assignMocks());
      const response = await request(app)
        .patch("/api/staff/tickets/101/assignment")
        .set("Cookie", staffCookie())
        .send({ ownerId });
      expect(response.status).toBe(400);
      expect(response.body.error.fields.ownerId).toBeDefined();
    }
  });

  it("returns 404 for an unknown owner user and 400 for a malformed body", async () => {
    mockPrisma(assignMocks());
    const unknown = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", staffCookie())
      .send({ ownerId: 4242 });
    expect(unknown.status).toBe(404);

    const malformed = await request(app)
      .patch("/api/staff/tickets/101/assignment")
      .set("Cookie", staffCookie())
      .send({ ownerId: "priya" });
    expect(malformed.status).toBe(400);
  });
});

describe("IT Priority update (AC-08, BR-12)", () => {
  it("sets IT Priority without touching Requested Priority", async () => {
    const update = vi.fn(async (args: { data: Record<string, unknown> }) => detailRow(args.data));
    mockPrisma({
      ...staffMocks(),
      ticket: { findUnique: vi.fn(async () => ({ id: 101 })), update },
    });

    const response = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", staffCookie())
      .send({ itPriority: "HIGH" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { itPriority: "HIGH" } }));
    const written = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(written).not.toHaveProperty("requestedPriority");
  });

  it("rejects invalid enum values with 400", async () => {
    mockPrisma(staffMocks());
    const response = await request(app)
      .patch("/api/staff/tickets/101/priority")
      .set("Cookie", staffCookie())
      .send({ itPriority: "URGENT" });
    expect(response.status).toBe(400);
  });
});

describe("status transitions (AC-08, AC-19, BR-13)", () => {
  const cases: Array<[string, string[]]> = Object.entries(STATUS_TRANSITIONS) as Array<[string, string[]]>;

  it.each(cases)("allows every matrix transition from %s", async (from, nexts) => {
    for (const next of nexts) {
      const update = vi.fn(async () => detailRow({ status: next }));
      mockPrisma({
        ...staffMocks(),
        ticket: { findUnique: vi.fn(async () => ({ id: 101, status: from })), update },
      });
      const response = await request(app)
        .patch("/api/staff/tickets/101/status")
        .set("Cookie", staffCookie())
        .send({ status: next });
      expect(response.status).toBe(200);
    }
  });

  it("rejects disallowed transitions with 409 naming the transition", async () => {
    mockPrisma({
      ...staffMocks(),
      ticket: { findUnique: vi.fn(async () => ({ id: 101, status: "NEW" })) },
    });
    const response = await request(app)
      .patch("/api/staff/tickets/101/status")
      .set("Cookie", staffCookie())
      .send({ status: "CLOSED" });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toMatch(/NEW.*CLOSED/i);
  });

  it("rejects legacy PENDING and unknown values with 400", async () => {
    for (const status of ["PENDING", "BOGUS"]) {
      mockPrisma(staffMocks());
      const response = await request(app)
        .patch("/api/staff/tickets/101/status")
        .set("Cookie", staffCookie())
        .send({ status });
      expect(response.status).toBe(400);
    }
  });
});
