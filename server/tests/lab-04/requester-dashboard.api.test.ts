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

const adminUser = {
  id: 31,
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMINISTRATOR",
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

describe("GET /api/dashboard/requester - Authentication & Role Permissions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/dashboard/requester");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 when IT_STAFF tries to access", async () => {
    const cookie = await loginAs(staffUser);
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when ADMINISTRATOR tries to access", async () => {
    const cookie = await loginAs(adminUser);
    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows REQUESTER to access with 200", async () => {
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
    expect(res.body.data).toBeDefined();
  });
});

describe("GET /api/dashboard/requester - Data Isolation", () => {
  it("only counts tickets owned by authenticated requester A (ignores requester B)", async () => {
    const cookie = await loginAs(requesterA);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);
    const ticketFindMany = vi.fn().mockResolvedValue([
      { id: 201, ticketNumber: "TT-0201", summary: "Issue A", status: "OPEN", updatedAt: new Date("2026-10-08T10:00:00.000Z") },
    ]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.openTickets).toBe(2);
    expect(res.body.data.awaitingMyResponse).toBe(1);
    expect(res.body.data.recentlyResolved).toBe(1);
    expect(res.body.data.totalSubmitted).toBe(4);

    const calls = ticketCount.mock.calls;
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i][0].where.requesterUserId).toBe(requesterA.id);
    }
    expect(ticketFindMany.mock.calls[0][0].where.requesterUserId).toBe(requesterA.id);
    expect(ticketCount.mock.calls.some((c: any) => c[0]?.where?.requesterUserId === requesterB.id)).toBe(false);
  });

  it("requester B gets isolated counts different from requester A", async () => {
    const cookie = await loginAs(requesterB);
    const ticketCount = vi.fn()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10);
    const ticketFindMany = vi.fn().mockResolvedValue([]);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: { count: ticketCount, findMany: ticketFindMany },
      user: mockUsersByEmail([requesterB]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.openTickets).toBe(5);
    expect(res.body.data.totalSubmitted).toBe(10);
    const calls = ticketCount.mock.calls;
    calls.forEach((c: any) => expect(c[0].where.requesterUserId).toBe(requesterB.id));
  });
});

describe("GET /api/dashboard/requester - Date Boundaries & Timezone (UTC)", () => {
  it("returns recentlyResolvedSince in UTC ISO format (ends with Z)", async () => {
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
    expect(new Date(res.body.data.recentlyResolvedSince).toISOString()).toBe(res.body.data.recentlyResolvedSince);
  });

  it("queries recently resolved with RESOLVED|CLOSED and updatedAt >= computed bound (30 days)", async () => {
    const cookie = await loginAs(requesterA);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(2).mockResolvedValueOnce(5),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.recentlyResolved).toBe(2);
    const prismaMock: any = vi.mocked(getPrisma)();
    const countCalls = prismaMock.ticket.count.mock.calls;
    expect(countCalls[2][0].where.status.in).toEqual(["RESOLVED", "CLOSED"]);
    expect(countCalls[2][0].where.updatedAt).toHaveProperty("gte");
    expect(countCalls[2][0].where.requesterUserId).toBe(requesterA.id);
  });

  it("openTickets excludes RESOLVED/CLOSED/CANCELLED", async () => {
    const cookie = await loginAs(requesterA);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(3),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[0][0].where.status.notIn).toEqual(["RESOLVED", "CLOSED", "CANCELLED"]);
  });

  it("awaitingMyResponse only counts WAITING_FOR_REQUESTER", async () => {
    const cookie = await loginAs(requesterA);
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        findMany: vi.fn().mockResolvedValue([]),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.count.mock.calls[1][0].where.status).toBe("WAITING_FOR_REQUESTER");
    expect(prismaMock.ticket.count.mock.calls[1][0].where.requesterUserId).toBe(requesterA.id);
  });
});

describe("GET /api/dashboard/requester - Structure & Drill-down readiness", () => {
  it("returns all required fields with correct types", async () => {
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
    const d = res.body.data;
    expect(typeof d.openTickets).toBe("number");
    expect(typeof d.awaitingMyResponse).toBe("number");
    expect(typeof d.recentlyResolved).toBe("number");
    expect(typeof d.totalSubmitted).toBe("number");
    expect(typeof d.recentlyResolvedSince).toBe("string");
    expect(Array.isArray(d.recentTickets)).toBe(true);
  });

  it("recentTickets limited to 5, ordered by updatedAt desc", async () => {
    const cookie = await loginAs(requesterA);
    const recent = [
      { id: 1, ticketNumber: "TT-0001", summary: "s1", status: "OPEN", updatedAt: new Date("2026-10-09T10:00:00.000Z") },
      { id: 2, ticketNumber: "TT-0002", summary: "s2", status: "NEW", updatedAt: new Date("2026-10-09T09:00:00.000Z") },
    ];
    vi.mocked(getPrisma).mockReturnValue({
      ticket: {
        count: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(2),
        findMany: vi.fn().mockResolvedValue(recent),
      },
      user: mockUsersByEmail([requesterA]),
    } as never);

    const res = await request(app).get("/api/dashboard/requester").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.recentTickets.length).toBe(2);
    expect(res.body.data.recentTickets[0].ticketNumber).toBe("TT-0001");
    const prismaMock: any = vi.mocked(getPrisma)();
    expect(prismaMock.ticket.findMany.mock.calls[0][0].take).toBe(5);
    expect(prismaMock.ticket.findMany.mock.calls[0][0].orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });
});
