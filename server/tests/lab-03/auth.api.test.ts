import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import {
  clearAllSessions,
  hashPassword,
  meetsPasswordPolicy,
  verifyPassword,
} from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

// Local-dev-style credential matching the documented seed password.
const DEV_PASSWORD = "Password123!";
const DEV_HASH = hashPassword(DEV_PASSWORD);

const activeRequester = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  passwordHash: DEV_HASH,
  legacyRequesterId: 7,
};

const mustChangeRequester = {
  ...activeRequester,
  id: 12,
  mustChangePassword: true,
};

const inactiveRequester = {
  ...activeRequester,
  id: 13,
  email: "david.brown@example.com",
  isActive: false,
};

function mockUsersByEmail(users: Array<typeof activeRequester>) {
  const byEmail = new Map(users.map((user) => [user.email, user]));
  const byId = new Map(users.map((user) => [user.id, user]));
  return {
    findUnique: vi.fn(async (args: { where: { email?: string; id?: number } }) => {
      if (args.where.email !== undefined) return byEmail.get(args.where.email) ?? null;
      if (args.where.id !== undefined) return byId.get(args.where.id) ?? null;
      return null;
    }),
  };
}

function sessionCookieHeader(response: request.Response): string {
  const setCookie = response.headers["set-cookie"] as unknown as string[];
  const session = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((cookie) =>
    cookie.startsWith("toktickit_session="),
  );
  expect(session).toBeDefined();
  return (session as string).split(";")[0];
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("POST /api/auth/login (AC-01, AC-16)", () => {
  it("logs in with valid credentials and sets the session cookie", async () => {
    mockPrisma({ user: mockUsersByEmail([activeRequester]) });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "Jennifer.Anderson@Example.com", password: DEV_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      id: 11,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
    });
    // BR-06/BR-08: no hash or secret ever reaches the client.
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("scrypt");
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const session = cookies.find((cookie) => cookie.startsWith("toktickit_session="));
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Lax");
  });

  it("returns 400 when the body is invalid", async () => {
    mockPrisma({ user: mockUsersByEmail([activeRequester]) });

    const response = await request(app).post("/api/auth/login").send({ email: "", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toBeDefined();
  });

  it("rejects wrong passwords, unknown emails, and inactive accounts identically (AC-16)", async () => {
    mockPrisma({ user: mockUsersByEmail([activeRequester, inactiveRequester]) });

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: "Wrongpass123!" });

    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "Wrongpass123!" });

    const inactive = await request(app)
      .post("/api/auth/login")
      .send({ email: "david.brown@example.com", password: DEV_PASSWORD });

    for (const response of [wrongPassword, unknownEmail, inactive]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: {
          code: "AUTHENTICATION_FAILED",
          message: "Invalid email or password.",
        },
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });
});

describe("GET /api/auth/me (AC-01)", () => {
  it("returns the safe identity for a valid session", async () => {
    mockPrisma({ user: mockUsersByEmail([activeRequester]) });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    const cookie = sessionCookieHeader(login);

    const response = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: 11,
      role: "REQUESTER",
      mustChangePassword: false,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("returns 401 without a session", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("POST /api/auth/logout (AC-05)", () => {
  it("invalidates the server-side session", async () => {
    mockPrisma({ user: mockUsersByEmail([activeRequester]) });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    const cookie = sessionCookieHeader(login);

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);
    expect(
      (logout.headers["set-cookie"] as unknown as string[]).some((entry) =>
        entry.startsWith("toktickit_session=;"),
      ),
    ).toBe(true);

    // The invalidated token cannot access protected resources anymore.
    const reuse = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(reuse.status).toBe(401);
  });

  it("returns 401 when logging out without a session", async () => {
    const response = await request(app).post("/api/auth/logout");
    expect(response.status).toBe(401);
  });
});

describe("POST /api/auth/change-password (AC-02, AC-17)", () => {
  function mockChangePasswordTarget() {
    const update = vi.fn(async (args: { data: { passwordHash: string; mustChangePassword?: boolean } }) => ({
      id: mustChangeRequester.id,
      name: mustChangeRequester.name,
      email: mustChangeRequester.email,
      role: mustChangeRequester.role,
      isActive: true,
      mustChangePassword: args.data.mustChangePassword ?? false,
    }));
    mockPrisma({
      user: {
        ...mockUsersByEmail([mustChangeRequester]),
        update,
      },
    });
    return update;
  }

  it("rotates the password, clears the flag, and rotates the session", async () => {
    const update = mockChangePasswordTarget();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    const oldCookie = sessionCookieHeader(login);

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", oldCookie)
      .send({
        currentPassword: DEV_PASSWORD,
        newPassword: "Newpass123!",
        confirmPassword: "Newpass123!",
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: 12, mustChangePassword: false });
    expect(update).toHaveBeenCalledOnce();
    const writtenHash = update.mock.calls[0][0].data.passwordHash as string;
    expect(writtenHash).not.toContain(DEV_PASSWORD);
    expect(verifyPassword("Newpass123!", writtenHash)).toBe(true);

    // Old session is dead; the fresh cookie from the response works.
    const stale = await request(app).get("/api/auth/me").set("Cookie", oldCookie);
    expect(stale.status).toBe(401);
    const fresh = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookieHeader(response));
    expect(fresh.status).toBe(200);
  });

  it("rejects mismatched confirmation and weak passwords with 400", async () => {
    mockChangePasswordTarget();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    const cookie = sessionCookieHeader(login);

    const mismatch = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: DEV_PASSWORD, newPassword: "Newpass123!", confirmPassword: "Other123!" });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.fields.confirmPassword).toBeDefined();

    const weak = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", cookie)
      .send({ currentPassword: DEV_PASSWORD, newPassword: "weak", confirmPassword: "weak" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.newPassword).toBeDefined();
  });

  it("rejects a wrong current password with 401", async () => {
    mockChangePasswordTarget();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", sessionCookieHeader(login))
      .send({ currentPassword: "Wrongpass123!", newPassword: "Newpass123!", confirmPassword: "Newpass123!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_FAILED");
  });
});

describe("mustChangePassword gate (AC-02)", () => {
  it("blocks normal routes with 403 while me/logout/change-password stay open", async () => {
    mockPrisma({
      user: mockUsersByEmail([mustChangeRequester]),
      ticket: { count: vi.fn(), findMany: vi.fn() },
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    const cookie = sessionCookieHeader(login);

    const blocked = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(me.status).toBe(200);

    const logout = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(204);
  });
});

describe("password hashing unit (UNIT-01, BR-08)", () => {
  it("verifies the same password, rejects a wrong one, and salts uniquely", () => {
    const first = hashPassword("Password123!");
    const second = hashPassword("Password123!");

    expect(first).toMatch(/^scrypt\$N=16384,r=8,p=1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(verifyPassword("Password123!", first)).toBe(true);
    expect(verifyPassword("password123!", first)).toBe(false);
    expect(first).not.toBe(second);
    expect(verifyPassword("not-a-hash", "garbage")).toBe(false);
    expect(verifyPassword("Password123!", "scrypt$N=1,r=1,p=1$00$00")).toBe(false);
  });

  it("enforces the documented password policy boundaries", () => {
    expect(meetsPasswordPolicy("Short1!")).toBe(false);
    expect(meetsPasswordPolicy("alllowercase1!")).toBe(false);
    expect(meetsPasswordPolicy("ALLUPPERCASE1!")).toBe(false);
    expect(meetsPasswordPolicy("NoNumbers!!")).toBe(false);
    expect(meetsPasswordPolicy("NoSpecial123")).toBe(false);
    expect(meetsPasswordPolicy("Password123!")).toBe(true);
  });
});

describe("seeded Requester migration regression (REG-01)", () => {
  it("a seeded Requester logs in and sees their pre-existing seeded tickets", async () => {
    // Mutable row: the change-password update below flips the flag, and later
    // session lookups must observe the cleared flag (as a real DB would).
    const seededRow = {
      ...activeRequester,
      mustChangePassword: true,
    };
    const ticketFindFirst = vi.fn(async () => ({
      id: 101,
      ticketNumber: "TKT-2026-000001",
      createdAt: new Date("2026-09-01T09:00:00Z"),
      category: { name: "Hardware" },
      relatedSystem: { name: "Corporate Laptop" },
      requester: { name: "Jennifer Anderson" },
      requestedPriority: "MEDIUM",
      itPriority: null,
      status: "NEW",
      ticketOwnerId: null,
      summary: "Laptop battery drains quickly",
      description: "Seeded ticket preserved through the Requester→User migration.",
      attachments: [],
    }));
    mockPrisma({
      user: {
        findUnique: vi.fn(async (args: { where: { email?: string; id?: number } }) => {
          if (args.where.email !== undefined) {
            return args.where.email === seededRow.email ? seededRow : null;
          }
          if (args.where.id !== undefined) {
            return args.where.id === seededRow.id ? seededRow : null;
          }
          return null;
        }),
        update: vi.fn(async () => {
          seededRow.mustChangePassword = false;
          return { ...seededRow };
        }),
      },
      ticket: {
        count: vi.fn(async () => 2),
        findMany: vi.fn(async () => [
          {
            id: 101,
            ticketNumber: "TKT-2026-000001",
            summary: "Laptop battery drains quickly",
            requestedPriority: "MEDIUM",
            itPriority: null,
            status: "NEW",
            createdAt: new Date("2026-09-01T09:00:00Z"),
            updatedAt: new Date("2026-09-01T09:00:00Z"),
            category: { name: "Hardware" },
          },
        ]),
        findFirst: ticketFindFirst,
      },
      requester: { findUnique: vi.fn(async () => ({ id: 7 })) },
    });

    // Seeded credentials force rotation first (BR-19).
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "jennifer.anderson@example.com", password: DEV_PASSWORD });
    expect(login.status).toBe(200);
    const gated = await request(app)
      .get("/api/tickets")
      .set("Cookie", sessionCookieHeader(login));
    expect(gated.status).toBe(403);

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set("Cookie", sessionCookieHeader(login))
      .send({ currentPassword: DEV_PASSWORD, newPassword: "Newpass123!", confirmPassword: "Newpass123!" });
    expect(changed.status).toBe(200);
    const cookie = sessionCookieHeader(changed);

    const list = await request(app).get("/api/tickets").set("Cookie", cookie);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].ticketNumber).toBe("TKT-2026-000001");

    const detail = await request(app).get("/api/tickets/101").set("Cookie", cookie);
    expect(detail.status).toBe(200);
    expect(ticketFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 101,
          OR: expect.arrayContaining([
            { requesterUserId: seededRow.id },
            { requesterId: seededRow.legacyRequesterId },
          ]),
        }),
      }),
    );
  });
});
