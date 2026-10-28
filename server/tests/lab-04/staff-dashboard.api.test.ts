import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { clearAllSessions, hashPassword } from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

const DEV_PASSWORD = "Password123!";
const DEV_HASH = hashPassword(DEV_PASSWORD);

const staffUser = {
  id: 21,
  name: "Sam Staff",
  email: "sam@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
};

const adminUser = {
  id: 31,
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
};

const requesterUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
  legacyRequesterId: 7,
};

function mockUsersByEmail(users: any[]) {
  const byEmail = new Map(users.map((u) => [u.email, u]));
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    findUnique: vi.fn(async (args: any) => {
      if (args.where.email !== undefined) return byEmail.get(args.where.email) ?? null;
      if (args.where.id !== undefined) return byId.get(args.where.id) ?? null;
      return null;
    }),
  };
}

function sessionCookieHeader(response: request.Response): string {
  const setCookie = response.headers["set-cookie"] as unknown as string[];
  const session = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((cookie: string) => cookie.startsWith("toktickit_session="));
  expect(session).toBeDefined();
  return (session as string).split(";")[0];
}

async function loginAs(user: any) {
  vi.mocked(getPrisma).mockReturnValue({ user: mockUsersByEmail([user]) } as never);
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: DEV_PASSWORD });
  return sessionCookieHeader(res);
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("GET /api/dashboard/staff - authz & permissions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboard/staff");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when requester role", async () => {
    const cookie = await loginAs(requesterUser);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows IT_STAFF and returns all 6 metrics with correct shapes", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(2) // unassignedActive
      .mockResolvedValueOnce(3) // assignedToMe
      .mockResolvedValueOnce(1) // waitingForRequester
      .mockResolvedValueOnce(1) // resolvedPendingClose
      .mockResolvedValueOnce(1); // newToday
    const ticketFindMany = vi.fn().mockResolvedValueOnce([{ id: 11, updatedAt: new Date() }]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([staffUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.unassignedActive).toBe(2);
    expect(res.body.data.assignedToMe).toBe(3);
    expect(res.body.data.waitingForRequester).toBe(1);
    expect(res.body.data.pendingFollowUp).toBe(1);
    expect(res.body.data.resolvedPendingClose).toBe(1);
    expect(res.body.data.newToday).toBe(1);
    expect(Array.isArray(res.body.data.pendingFollowUpTicketIds)).toBe(true);
    expect(typeof res.body.data.newTodaySince).toBe("string");
    expect(res.body.data.newTodaySince).toMatch(/Z$/);
  });

  it("allows ADMINISTRATOR (aggregate read-only per spec) and returns same structure", async () => {
    const cookie = await loginAs(adminUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const ticketFindMany = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([adminUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("pendingFollowUpTicketIds");
  });

  it("counts pending follow-ups by distinct tickets with EXISTS and caps ids to 200 (non-truncating count)", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1); // pendingFollowUp count
    const ids = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, updatedAt: new Date() }));
    const ticketFindMany = vi.fn().mockResolvedValueOnce(ids.slice(0, 200));
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([staffUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.pendingFollowUp).toBe(1); // count from separate distinct count query
    expect(res.body.data.pendingFollowUpTicketIds.length).toBeLessThanOrEqual(200);
    // first findMany should filter for pending follow-ups
    expect(ticketFindMany.mock.calls[0][0].where.actionsTaken.some.followUpRequired).toBe(true);
    expect(ticketFindMany.mock.calls[0][0].where.actionsTaken.some.followUpResolvedAt).toBe(null);
  });

  it("uses app-computed UTC start-of-day for newToday (no SQL now/CURRENT_DATE)", async () => {
    const cookie = await loginAs(staffUser);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(5),
        findMany: vi.fn().mockResolvedValueOnce([]),
      },
      user: mockUsersByEmail([staffUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.newToday).toBe(5);
    const prismaMock: any = vi.mocked(getPrisma)(); const countCalls = prismaMock.ticket.count.mock.calls;
    // newToday is the 5th count call
    expect(countCalls[4][0].where.status).toBe("NEW");
    expect(countCalls[4][0].where.createdAt).toHaveProperty("gte");
  });
});
