import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import {
  authorize,
  ownedTicketFilter,
} from "../../src/middleware/authorize.middleware.js";
import {
  clearAllSessions,
  createSession,
  hashPassword,
} from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

const DEV_HASH = hashPassword("Password123!");

// Authenticated Requester "A" (session user id 11, legacy requester row 7).
const userA = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
  legacyRequesterId: 7,
};

function sessionMocks(extra: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => userA),
      findFirst: vi.fn(async () => userA),
    },
    requester: {
      findUnique: vi.fn(async () => ({ id: 7 })),
      findFirst: vi.fn(async () => ({ id: 7, name: "Jennifer Anderson" })),
      findMany: vi.fn(async () => []),
    },
    ...extra,
  };
}

function authCookie(userId = userA.id): string {
  return `toktickit_session=${createSession(userId)}`;
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("unauthenticated access (SEC-01)", () => {
  it("returns 401 UNAUTHENTICATED for every protected endpoint without a session", async () => {
    mockPrisma(sessionMocks());

    const calls = [
      request(app).get("/api/tickets"),
      request(app).get("/api/tickets/1"),
      request(app).post("/api/tickets").field("summary", "x"),
      request(app).post("/api/tickets/1/attachments"),
      request(app).get("/api/attachments/1"),
      request(app).get("/api/attachments/1/download"),
      request(app).patch("/api/attachments/1/remove").send({ reason: "A valid reason" }),
      request(app).get("/api/tickets/1/comments"),
      request(app).post("/api/tickets/1/comments").send({ content: "Hi" }),
      request(app).post("/api/tickets/1/problem-appears-resolved"),
      request(app).get("/api/categories"),
      request(app).get("/api/related-systems"),
      request(app).get("/api/requesters"),
      request(app).post("/api/auth/logout"),
      request(app).get("/api/auth/me"),
    ];

    for (const call of calls) {
      const response = await call;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  it("returns 401 for an expired/unknown session token", async () => {
    mockPrisma(sessionMocks());
    const response = await request(app)
      .get("/api/tickets")
      .set("Cookie", "toktickit_session=does-not-exist");
    expect(response.status).toBe(401);
  });
});

describe("forged requesterId is ignored (AUTHZ-01, AC-03)", () => {
  it("creates the ticket under the session identity despite a forged body requesterId", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: 201,
      ticketNumber: "TKT-2026-000201",
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      createdAt: new Date("2026-09-26T00:00:00Z"),
      ...args.data,
    }));
    mockPrisma(
      sessionMocks({
        category: { findFirst: vi.fn(async () => ({ id: 2, name: "Hardware" })) },
        relatedSystem: { findFirst: vi.fn(async () => ({ id: 3, name: "Corporate Laptop" })) },
        ticket: { findFirst: vi.fn(async () => null), create },
        attachment: { create: vi.fn() },
      }),
    );

    const response = await request(app)
      .post("/api/tickets")
      .set("Cookie", authCookie())
      .field("categoryId", "2")
      .field("relatedSystemId", "3")
      .field("summary", "Forged ownership attempt")
      .field("description", "The body claims another requester.")
      .field("requestedPriority", "MEDIUM")
      .field("requesterId", "999");

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledOnce();
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.requesterUserId).toBe(userA.id);
    expect(data.requesterId).toBe(userA.legacyRequesterId);
    expect(data.requesterId).not.toBe(999);
  });

  it("returns 404 (not another user's data) for a ticket owned by someone else", async () => {
    const findFirst = vi.fn(async () => null);
    mockPrisma(sessionMocks({ ticket: { findFirst } }));

    const response = await request(app).get("/api/tickets/999").set("Cookie", authCookie());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    // The ownership predicate — not any client value — scoped the lookup.
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 999,
          OR: [{ requesterUserId: userA.id }, { requesterId: userA.legacyRequesterId }],
        }),
      }),
    );
  });

  it("scopes list queries to the session owner", async () => {
    const findMany = vi.fn(async (_query: { where: Record<string, unknown> }) => []);
    mockPrisma(
      sessionMocks({
        ticket: { count: vi.fn(async () => 0), findMany },
      }),
    );

    const response = await request(app).get("/api/tickets").set("Cookie", authCookie());

    expect(response.status).toBe(200);
    const where = findMany.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where).toMatchObject({
      OR: [{ requesterUserId: userA.id }, { requesterId: userA.legacyRequesterId }],
    });
  });

  it("hides another Requester's comments behind 404", async () => {
    mockPrisma(
      sessionMocks({
        ticket: { findFirst: vi.fn(async () => null) },
      }),
    );

    const response = await request(app)
      .post("/api/tickets/999/comments")
      .set("Cookie", authCookie())
      .send({ content: "Trying to comment on someone else's ticket" });

    expect(response.status).toBe(404);
  });
});

describe("role guard in isolation (UNIT-03, AUTHZ-02)", () => {
  function mockRes() {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: unknown) {
        res.body = payload;
        return res;
      },
    };
    return res;
  }

  it("allows a permitted role and denies others without leaking data", () => {
    const guard = authorize(["IT_STAFF"]);
    const next = vi.fn();

    const unauthenticated = mockRes();
    guard({} as never, unauthenticated as never, next);
    expect(unauthenticated.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();

    const forbidden = mockRes();
    guard(
      { user: { id: 11, role: "REQUESTER", mustChangePassword: false } } as never,
      forbidden as never,
      next,
    );
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toEqual({
      error: { code: "FORBIDDEN", message: expect.any(String) },
    });
    expect(next).not.toHaveBeenCalled();

    guard(
      { user: { id: 21, role: "IT_STAFF", mustChangePassword: false } } as never,
      mockRes() as never,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it("builds the ownership predicate with and without a legacy link", () => {
    expect(ownedTicketFilter({ id: 11, legacyRequesterId: 7 })).toEqual({
      OR: [{ requesterUserId: 11 }, { requesterId: 7 }],
    });
    expect(ownedTicketFilter({ id: 11, legacyRequesterId: null })).toEqual({
      requesterUserId: 11,
    });
  });
});

describe("requester collaboration rules (AC-09, AC-18)", () => {
  it("lets the owner post and read public comments, append-only", async () => {
    const stored = {
      id: 301,
      ticketId: 101,
      content: "Thanks for looking into this.",
      createdAt: new Date("2026-09-26T01:00:00Z"),
      author: { id: 11, name: "Jennifer Anderson", role: "REQUESTER" },
    };
    mockPrisma(
      sessionMocks({
        ticket: { findFirst: vi.fn(async () => ({ id: 101 })) },
        publicComment: {
          create: vi.fn(async () => stored),
          findMany: vi.fn(async () => [stored]),
        },
      }),
    );

    const posted = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", authCookie())
      .send({ content: "Thanks for looking into this." });
    expect(posted.status).toBe(201);
    expect(posted.body.data).toMatchObject({
      ticketId: 101,
      author: { id: 11, role: "REQUESTER" },
    });

    const listed = await request(app).get("/api/tickets/101/comments").set("Cookie", authCookie());
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);

    const blank = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", authCookie())
      .send({ content: "   " });
    expect(blank.status).toBe(400);

    const tooLong = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", authCookie())
      .send({ content: "x".repeat(2001) });
    expect(tooLong.status).toBe(400);
  });

  it("records the resolved signal as a flag without changing status (BR-05)", async () => {
    const update = vi.fn(
      async (_args: { where: { id: number }; data: Record<string, unknown> }) => ({
        id: 101,
        problemAppearsResolvedAt: new Date("2026-09-26T02:00:00Z"),
      }),
    );
    mockPrisma(
      sessionMocks({
        ticket: {
          findFirst: vi.fn(async () => ({
            id: 101,
            status: "IN_PROGRESS",
            problemAppearsResolvedAt: null,
          })),
          update,
        },
      }),
    );

    const response = await request(app)
      .post("/api/tickets/101/problem-appears-resolved")
      .set("Cookie", authCookie());

    expect(response.status).toBe(200);
    expect(response.body.data.ticketId).toBe(101);
    expect(response.body.data.problemAppearsResolvedAt).toBeDefined();
    const data = update.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data.problemAppearsResolvedAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("status");
  });
});

describe("safe failure matrix (SEC-01)", () => {
  it("keeps 400/404/500 envelopes safe with no stack traces", async () => {
    mockPrisma(
      sessionMocks({
        category: { findMany: vi.fn(async () => [{ id: 1, name: "Hardware" }]) },
        ticket: { findFirst: vi.fn(async () => null) },
        requester: {
          findMany: vi.fn(async () => {
            throw new Error("database failure");
          }),
        },
      }),
    );
    const cookie = authCookie();

    const invalidQuery = await request(app)
      .get("/api/tickets?status=PENDING")
      .set("Cookie", cookie);
    expect(invalidQuery.status).toBe(400);
    expect(invalidQuery.body.error.code).toBe("VALIDATION_ERROR");

    const hidden = await request(app).get("/api/tickets/4242").set("Cookie", cookie);
    expect(hidden.status).toBe(404);
    expect(hidden.body).toEqual({
      error: { code: "NOT_FOUND", message: "Ticket not found." },
    });

    const failure = await request(app).get("/api/requesters").set("Cookie", cookie);
    expect(failure.status).toBe(500);
    expect(failure.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "Unable to fetch requesters" },
    });
    expect(JSON.stringify(failure.body)).not.toContain("database failure");
  });
});
