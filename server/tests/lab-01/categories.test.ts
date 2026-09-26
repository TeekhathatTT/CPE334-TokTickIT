import { beforeEach, describe, it, expect, vi } from "vitest";
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

// Lab 3: GET /api/categories requires an authenticated Requester session
// (api-spec.md §2). The category payload assertions below are unchanged.
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

function mockSessionPrisma(categoryMock: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue({
    user: {
      findUnique: vi.fn().mockResolvedValue(sessionUser),
      findFirst: vi.fn().mockResolvedValue(sessionUser),
    },
    category: categoryMock,
  } as never);
}

beforeEach(() => {
  clearAllSessions();
});

describe("GET /api/categories", () => {
  it("returns 401 without an authenticated session", async () => {
    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns the four seeded categories in id order", async () => {
    mockSessionPrisma({
      findMany: vi.fn().mockResolvedValue([
        { id: 1, name: "Account and Access", isActive: true },
        { id: 2, name: "Hardware", isActive: true },
        { id: 3, name: "Software", isActive: true },
        { id: 4, name: "Network", isActive: true },
      ]),
    });

    const res = await request(app).get("/api/categories").set("Cookie", authCookie());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { id: 1, name: "Account and Access", isActive: true },
        { id: 2, name: "Hardware", isActive: true },
        { id: 3, name: "Software", isActive: true },
        { id: 4, name: "Network", isActive: true },
      ],
    });
  });

  it("returns the contract error envelope when the database fails", async () => {
    mockSessionPrisma({
      findMany: vi.fn().mockRejectedValue(new Error("database failure")),
    });

    const res = await request(app).get("/api/categories").set("Cookie", authCookie());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch categories",
      },
    });
  });
});
