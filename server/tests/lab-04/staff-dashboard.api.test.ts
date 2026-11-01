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
  const sessionArr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const session = sessionArr.find((cookie: string) => cookie.startsWith("toktickit_session="));
  expect(session).toBeDefined();
  return (session as string).split(";")[0];
}

async function loginAs(user: any) {
  vi.mocked(getPrisma).mockReturnValue({ user: mockUsersByEmail([user]) } as never);
  const res = await request(app).post("/api/auth/login").send({ email: user.email, password: DEV_PASSWORD });
  expect(res.status).toBe(200);
  return sessionCookieHeader(res);
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("GET /api/dashboard/staff - Authentication & Role Permissions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboard/staff");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when REQUESTER role", async () => {
    const cookie = await loginAs(requesterUser);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows IT_STAFF (200)", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(2).mockResolvedValueOnce(3).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValue([{ id: 11, updatedAt: new Date() }]) },
      user: mockUsersByEmail([staffUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });

  it("allows ADMINISTRATOR (200, read-only aggregate)", async () => {
    const cookie = await loginAs(adminUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValue([]) },
      user: mockUsersByEmail([adminUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/dashboard/staff - Metrics & Structure", () => {
  it("returns all 6 metrics with correct shapes and UTC newTodaySince", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(2) // unassignedActive
      .mockResolvedValueOnce(3) // assignedToMe
      .mockResolvedValueOnce(1) // waitingForRequester
      .mockResolvedValueOnce(1) // resolvedPendingClose
      .mockResolvedValueOnce(1) // newToday
      .mockResolvedValueOnce(1); // pendingFollowUp count
    const ticketFindMany = vi.fn().mockResolvedValueOnce([{ id: 11, updatedAt: new Date() }]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([staffUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.unassignedActive).toBe(2);
    expect(d.assignedToMe).toBe(3);
    expect(d.waitingForRequester).toBe(1);
    expect(d.pendingFollowUp).toBe(1);
    expect(d.resolvedPendingClose).toBe(1);
    expect(d.newToday).toBe(1);
    expect(Array.isArray(d.pendingFollowUpTicketIds)).toBe(true);
    expect(typeof d.newTodaySince).toBe("string");
    expect(d.newTodaySince).toMatch(/Z$/);
  });

  it("pendingFollowUp counted as distinct tickets via EXISTS logic (separate count call)", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(4);
    const ids = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, updatedAt: new Date() }));
    const ticketFindMany = vi.fn().mockResolvedValueOnce(ids.slice(0, 200));
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([staffUser]),
    } as never);

    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.pendingFollowUp).toBe(4);
    expect(res.body.data.pendingFollowUpTicketIds.length).toBeLessThanOrEqual(200);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where.actionsTaken.some.followUpRequired).toBe(true);
    expect(prismaMock.ticket.findMany.mock.calls[0][0].where.actionsTaken.some.followUpResolvedAt).toBe(null);
  });

  it("resolvedPendingClose is RESOLVED status count", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(7).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValueOnce([]) },
      user: mockUsersByEmail([staffUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.resolvedPendingClose).toBe(7);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[3][0].where.status).toBe("RESOLVED");
  });

  it("newToday uses UTC start of day with createdAt >= newTodaySince", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValueOnce([]) },
      user: mockUsersByEmail([staffUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.newToday).toBe(5);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[4][0].where.status).toBe("NEW");
    expect(prismaMock.ticket.count.mock.calls[4][0].where.createdAt).toHaveProperty("gte");
  });

  it("assignedToMe excludes closed/cancelled", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(0).mockResolvedValueOnce(4).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValueOnce([]) },
      user: mockUsersByEmail([staffUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.assignedToMe).toBe(4);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[1][0].where.ticketOwnerId).toBe(staffUser.id);
    expect(prismaMock.ticket.count.mock.calls[1][0].where.status.notIn).toEqual(["CLOSED", "CANCELLED"]);
  });

  it("unassignedActive excludes RESOLVED/CLOSED/CANCELLED and requires unassigned", async () => {
    const cookie = await loginAs(staffUser);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(6).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: vi.fn().mockResolvedValueOnce([]) },
      user: mockUsersByEmail([staffUser]),
    } as never);
    const res = await request(app).get("/api/dashboard/staff").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[0][0].where.ticketOwnerId).toBe(null);
    expect(prismaMock.ticket.count.mock.calls[0][0].where.status.notIn).toEqual(["RESOLVED", "CLOSED", "CANCELLED"]);
  });
});
