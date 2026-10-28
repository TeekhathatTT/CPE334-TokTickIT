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

const requesterA = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
  legacyRequesterId: 7,
};

const requesterB = {
  id: 12,
  name: "Alex Requester",
  email: "alex@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
  legacyRequesterId: null,
};

const staffUser = {
  id: 21,
  name: "Sam Staff",
  email: "sam@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
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

describe("GET /api/dashboard/requester - authz & isolation", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboard/requester");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when requester is wrong role (IT_STAFF)", async () => {
    const cookie = await loginAs(staffUser);
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 200 with zero/empty-safe structure for requester with no tickets", async () => {
    const cookie = await loginAs(requesterA);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("openTickets");
    expect(res.body.data).toHaveProperty("awaitingMyResponse");
    expect(res.body.data).toHaveProperty("recentlyResolved");
    expect(res.body.data).toHaveProperty("recentlyResolvedSince");
    expect(res.body.data).toHaveProperty("totalSubmitted");
    expect(res.body.data).toHaveProperty("recentTickets");
    expect(Array.isArray(res.body.data.recentTickets)).toBe(true);
    expect(res.body.data.openTickets).toBe(0);
    expect(res.body.data.awaitingMyResponse).toBe(0);
    expect(res.body.data.recentlyResolved).toBe(0);
    expect(res.body.data.totalSubmitted).toBe(0);
  });

  it("counts only tickets owned by the authenticated requester (data isolation)", async () => {
    const cookie = await loginAs(requesterA);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(3) // openTickets for requesterA
      .mockResolvedValueOnce(1) // awaitingMyResponse
      .mockResolvedValueOnce(2) // recentlyResolved
      .mockResolvedValueOnce(6); // totalSubmitted
    const ticketFindMany = vi.fn().mockResolvedValue([
      { id: 101, ticketNumber: "TT-0101", summary: "x", status: "OPEN", updatedAt: new Date("2026-10-08T10:00:00.000Z") },
    ]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.openTickets).toBe(3);
    expect(res.body.data.awaitingMyResponse).toBe(1);
    expect(res.body.data.recentlyResolved).toBe(2);
    expect(res.body.data.totalSubmitted).toBe(6);
    expect(res.body.data.recentTickets.length).toBe(1);
    // Verify isolation: all ticket queries should filter by requesterUserId = requesterA.id
    const calls = ticketCount.mock.calls;
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i][0].where.requesterUserId).toBe(requesterA.id);
    }
    expect(ticketFindMany.mock.calls[0][0].where.requesterUserId).toBe(requesterA.id);
  });

  it("uses app-computed UTC date boundaries (frozen-clock safe) and returns recentlyResolvedSince", async () => {
    const cookie = await loginAs(requesterA);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(1),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.recentlyResolvedSince).toBe("string");
    expect(res.body.data.recentlyResolvedSince).toMatch(/Z$/);
    // recentlyResolved should query with updatedAt gte computed bound (not SQL now())
    const prismaMock: any = vi.mocked(getPrisma)(); const countCalls = prismaMock.ticket.count.mock.calls;
    expect(countCalls[2][0].where.status.in).toEqual(["RESOLVED", "CLOSED"]);
    expect(countCalls[2][0].where.updatedAt).toHaveProperty("gte");
  });
});
