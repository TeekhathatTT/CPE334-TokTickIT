import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import {
  clearAllSessions,
  createSession,
} from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

// Lab 3: GET /api/requesters is retained behind an authenticated Requester
// session (api-spec.md §2); the Development selector UI that consumed it is
// gone. The active-only listing behavior under test is unchanged.
const sessionUser = {
  id: 1,
  isActive: true,
  legacyRequesterId: 1,
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  mustChangePassword: false,
};

function authCookie(): string {
  return `toktickit_session=${createSession(sessionUser.id)}`;
}

function mockSessionPrisma(requesterMock: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue({
    user: {
      findUnique: vi.fn().mockResolvedValue(sessionUser),
      findFirst: vi.fn().mockResolvedValue(sessionUser),
    },
    requester: requesterMock,
  } as never);
}

beforeEach(() => {
  clearAllSessions();
});

describe("GET /api/requesters", () => {
  it("returns 401 without an authenticated session", async () => {
    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns active requesters only", async () => {
    mockSessionPrisma({
      findMany: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Jennifer Anderson",
          email: "jennifer.anderson@example.com",
        },
        {
          id: 2,
          name: "Michael Chen",
          email: "michael.chen@example.com",
        },
      ]),
    });

    const response = await request(app).get("/api/requesters").set("Cookie", authCookie());

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      data: [
        {
          id: 1,
          name: "Jennifer Anderson",
          email: "jennifer.anderson@example.com",
        },
        {
          id: 2,
          name: "Michael Chen",
          email: "michael.chen@example.com",
        },
      ],
    });

    expect(getPrisma().requester.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("returns a safe 500 response when the database fails", async () => {
    mockSessionPrisma({
      findMany: vi.fn().mockRejectedValue(new Error("database failure")),
    });

    const response = await request(app).get("/api/requesters").set("Cookie", authCookie());

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch requesters",
      },
    });
  });
});