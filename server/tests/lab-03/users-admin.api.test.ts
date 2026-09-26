import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import {
  clearAllSessions,
  createSession,
  hashPassword,
  verifyPassword,
} from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

const DEV_PASSWORD = "Password123!";
const NEW_PASSWORD = "Newpass123!";

// Authenticated Administrator (session id 99, fresh password).
const adminUser = {
  id: 99,
  name: "Alice Admin",
  email: "alice.admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
};

const secondAdmin = {
  id: 100,
  name: "Bob Admin",
  email: "bob.admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
};
void secondAdmin;

const requesterUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
};

const staffUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

function adminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    name: "Jennifer Anderson",
    email: "jennifer.anderson@example.com",
    role: "REQUESTER",
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date("2026-09-01T09:00:00Z"),
    updatedAt: new Date("2026-09-02T09:00:00Z"),
    ...overrides,
  };
}

/** Session lookup + optional user table for email/id branching. */
function userMock(byId: Map<number, any>, byEmail?: Map<string, any>): any {
  return {
    findUnique: vi.fn(async (args: { where: { id?: number; email?: string } }) => {
      if (args.where.id !== undefined) return byId.get(args.where.id) ?? null;
      if (args.where.email !== undefined) {
        if (byEmail) return byEmail.get(args.where.email) ?? null;
        for (const row of byId.values() as IterableIterator<{ email?: string }>) {
          if (row.email === args.where.email) return row;
        }
        return null;
      }
      return null;
    }),
    findMany: vi.fn(async (_args?: any) => []),
    findFirst: vi.fn(async (_args?: any) => null),
    create: vi.fn(async (_args?: any) => null),
    update: vi.fn(async (_args?: any) => null),
    count: vi.fn(async (_args?: any) => 0),
  };
}

function adminCookie(userId = adminUser.id): string {
  return `toktickit_session=${createSession(userId)}`;
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("GET /api/admin/users listing, search, filter (AC-10, API-11)", () => {
  it("lists users with safe fields only (no passwordHash)", async () => {
    const rows = [adminRow(), adminRow({ id: 12, email: "michael.chen@example.com", name: "Michael Chen" })];
    const byId = new Map<number, unknown>([
      [adminUser.id, adminUser],
    ]);
    const mock = userMock(byId);
    mock.findMany.mockResolvedValue(rows);
    mockPrisma({ user: mock });

    const response = await request(app).get("/api/admin/users").set("Cookie", adminCookie());

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toMatchObject({
      id: 11,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      isActive: true,
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("scrypt");
  });

  it("searches by name and by email (partial, case-insensitive)", async () => {
    const byId = new Map<number, any>([[adminUser.id, adminUser]]);
    const mock = userMock(byId);
    const findMany = vi.fn(async (_args: any) => [adminRow()]);
    mock.findMany = findMany;
    mockPrisma({ user: mock });

    const byName = await request(app).get("/api/admin/users?search=jennifer").set("Cookie", adminCookie());
    expect(byName.status).toBe(200);
    let where = (findMany.mock.calls[0] as any[])[0].where as Record<string, unknown>;
    expect(JSON.stringify(where.OR)).toContain("jennifer");

    const byEmail = await request(app).get("/api/admin/users?search=EXAMPLE.COM").set("Cookie", adminCookie());
    expect(byEmail.status).toBe(200);
    where = (findMany.mock.calls[1] as any[])[0].where as Record<string, unknown>;
    expect(JSON.stringify(where.OR)).toContain("EXAMPLE.COM");
  });

  it("filters by a single role", async () => {
    const byId = new Map<number, any>([[adminUser.id, adminUser]]);
    const findMany = vi.fn(async (_args: any) => [adminRow({ role: "IT_STAFF" })]);
    const mock = userMock(byId);
    mock.findMany = findMany;
    mockPrisma({ user: mock });

    const response = await request(app)
      .get("/api/admin/users?role=IT_STAFF")
      .set("Cookie", adminCookie());

    expect(response.status).toBe(200);
    const where = (findMany.mock.calls[0] as any[])[0].where as Record<string, unknown>;
    expect(where.role).toBe("IT_STAFF");
  });

  it("rejects invalid query values with 400", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    mockPrisma({ user: userMock(byId) });

    const badRole = await request(app).get("/api/admin/users?role=SUPERUSER").set("Cookie", adminCookie());
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.code).toBe("VALIDATION_ERROR");

    const longSearch = await request(app)
      .get(`/api/admin/users?search=${"x".repeat(121)}`)
      .set("Cookie", adminCookie());
    expect(longSearch.status).toBe(400);
  });
});

describe("POST /api/admin/users create (AC-11, API-12)", () => {
  it("creates with valid data, hashes password, forces mustChangePassword", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    const byEmail = new Map<string, unknown>();
    const mock = userMock(byId, byEmail);
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: 31,
      name: args.data.name,
      email: args.data.email,
      role: args.data.role,
      isActive: args.data.isActive,
      mustChangePassword: args.data.mustChangePassword,
      createdAt: new Date("2026-09-26T00:00:00Z"),
      updatedAt: new Date("2026-09-26T00:00:00Z"),
    }));
    mock.create = create;
    mockPrisma({ user: mock });

    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie())
      .send({
        name: "New Staff",
        email: "New.Staff@Example.com",
        role: "IT_STAFF",
        isActive: true,
        initialPassword: DEV_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      email: "new.staff@example.com",
      role: "IT_STAFF",
      mustChangePassword: true,
    });
    expect(create).toHaveBeenCalledOnce();
    const written = create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(written.email).toBe("new.staff@example.com");
    expect(written.mustChangePassword).toBe(true);
    expect(verifyPassword(DEV_PASSWORD, written.passwordHash as string)).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("rejects duplicate email case-insensitively with 409", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    const byEmail = new Map<string, unknown>([
      ["taken@example.com", adminRow({ id: 40, email: "taken@example.com" })],
    ]);
    mockPrisma({ user: userMock(byId, byEmail) });

    const response = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie())
      .send({
        name: "Clash",
        email: "TAKEN@Example.com",
        role: "REQUESTER",
        isActive: true,
        initialPassword: DEV_PASSWORD,
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(response.body.error.fields.email).toBeDefined();
  });

  it("rejects an invalid role and weak password with 400", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    mockPrisma({ user: userMock(byId) });

    const badRole = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie())
      .send({ name: "X", email: "x@example.com", role: "SUPERUSER", isActive: true, initialPassword: DEV_PASSWORD });
    expect(badRole.status).toBe(400);
    expect(badRole.body.error.fields.role).toBeDefined();

    const weak = await request(app)
      .post("/api/admin/users")
      .set("Cookie", adminCookie())
      .send({ name: "X", email: "y@example.com", role: "REQUESTER", isActive: true, initialPassword: "weak" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.initialPassword).toBeDefined();
  });
});

describe("PATCH /api/admin/users/:id edit (AC-10, API-13)", () => {
  it("updates name/email/role/isActive", async () => {
    const target = adminRow({ id: 31, role: "REQUESTER", isActive: true });
    const byId = new Map<number, unknown>([
      [adminUser.id, adminUser],
      [31, target],
    ]);
    const mock = userMock(byId, new Map());
    mock.count = vi.fn(async () => 2);
    const update = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      ...target,
      ...args.data,
      updatedAt: new Date("2026-09-26T01:00:00Z"),
      createdAt: target.createdAt,
      mustChangePassword: false,
    }));
    mock.update = update;
    mockPrisma({ user: mock });

    const response = await request(app)
      .patch("/api/admin/users/31")
      .set("Cookie", adminCookie())
      .send({ name: "Renamed", email: "renamed@example.com", role: "IT_STAFF", isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ name: "Renamed", email: "renamed@example.com" });
    expect(update).toHaveBeenCalledOnce();
  });

  it("rejects duplicate email on edit with 409", async () => {
    const target = adminRow({ id: 31, email: "first@example.com" });
    const byId = new Map<number, unknown>([
      [adminUser.id, adminUser],
      [31, target],
    ]);
    const byEmail = new Map<string, unknown>([
      ["second@example.com", adminRow({ id: 32, email: "second@example.com" })],
    ]);
    mockPrisma({ user: userMock(byId, byEmail) });

    const response = await request(app)
      .patch("/api/admin/users/31")
      .set("Cookie", adminCookie())
      .send({ email: "SECOND@example.com" });

    expect(response.status).toBe(409);
    expect(response.body.error.fields.email).toBeDefined();
  });

  it("rejects self-deactivation with 409 (AC-12, API-14)", async () => {
    const byId = new Map<number, unknown>([
      [adminUser.id, { ...adminUser, name: "Alice Admin" }],
    ]);
    mockPrisma({ user: userMock(byId) });

    const response = await request(app)
      .patch(`/api/admin/users/${adminUser.id}`)
      .set("Cookie", adminCookie())
      .send({ isActive: false });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT");
    expect(JSON.stringify(response.body)).toMatch(/own account/i);
  });

  it("rejects deactivating the last active Administrator with 409 (AC-13)", async () => {
    const loneAdmin = { id: 99, name: "Alice Admin", email: "alice.admin@example.com", role: "ADMINISTRATOR", isActive: true };
    const byId = new Map<number, unknown>([
      [99, adminUser],
      // Target is a different admin? For self-case the guard above fires first;
      // here the caller is admin 99 deactivating lone admin 101.
      [101, loneAdmin],
    ]);
    const mock = userMock(byId, new Map());
    // No other active admins remain.
    mock.count = vi.fn(async () => 0);
    mockPrisma({ user: mock });

    const deactivate = await request(app)
      .patch("/api/admin/users/101")
      .set("Cookie", adminCookie(99))
      .send({ isActive: false });
    expect(deactivate.status).toBe(409);

    const demote = await request(app)
      .patch("/api/admin/users/101")
      .set("Cookie", adminCookie(99))
      .send({ role: "IT_STAFF" });
    expect(demote.status).toBe(409);
  });

  it("allows deactivation when another active Administrator remains", async () => {
    const target = { id: 100, name: "Bob Admin", email: "bob.admin@example.com", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false, createdAt: new Date(), updatedAt: new Date() };
    const byId = new Map<number, unknown>([
      [adminUser.id, adminUser],
      [100, target],
    ]);
    const mock = userMock(byId, new Map());
    mock.count = vi.fn(async () => 1);
    mock.update = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      ...target,
      ...args.data,
    }));
    mockPrisma({ user: mock });

    const response = await request(app)
      .patch("/api/admin/users/100")
      .set("Cookie", adminCookie())
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.data.isActive).toBe(false);
  });

  it("returns 404 for a nonexistent user id", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    mockPrisma({ user: userMock(byId) });

    const response = await request(app)
      .patch("/api/admin/users/9999")
      .set("Cookie", adminCookie())
      .send({ name: "Ghost" });

    expect(response.status).toBe(404);
  });
});

describe("POST initial-password reset (AC-14, API-15)", () => {
  it("sets mustChangePassword=true and the new password verifies (canonical + alias)", async () => {
    const target = {
      id: 11,
      name: "Jennifer Anderson",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: false,
      passwordHash: hashPassword("Oldpass123!"),
      createdAt: new Date("2026-09-01T00:00:00Z"),
      updatedAt: new Date("2026-09-01T00:00:00Z"),
    };
    const byId = new Map<number, unknown>([
      [adminUser.id, adminUser],
      [11, target],
    ]);
    const mock = userMock(byId);
    let writtenHash = "";
    mock.update = vi.fn(async (args: { data: { passwordHash: string; mustChangePassword: boolean } }) => {
      writtenHash = args.data.passwordHash;
      return {
        id: 11,
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: true,
        mustChangePassword: true,
        createdAt: target.createdAt,
        updatedAt: new Date("2026-09-26T02:00:00Z"),
      };
    });
    mockPrisma({ user: mock });

    for (const path of ["/api/admin/users/11/initial-password", "/api/admin/users/11/reset-password"]) {
      const response = await request(app)
        .post(path)
        .set("Cookie", adminCookie())
        .send({ initialPassword: NEW_PASSWORD });

      expect(response.status).toBe(200);
      expect(response.body.data.mustChangePassword).toBe(true);
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    }
    expect(verifyPassword(NEW_PASSWORD, writtenHash)).toBe(true);
    expect(verifyPassword("Oldpass123!", writtenHash)).toBe(false);
  });

  it("new password logs in but normal routes stay gated until change (AC-14)", async () => {
    const freshHash = hashPassword(NEW_PASSWORD);
    const gatedUser = {
      id: 12,
      name: "Michael Chen",
      email: "michael.chen@example.com",
      role: "REQUESTER",
      isActive: true,
      mustChangePassword: true,
      passwordHash: freshHash,
      legacyRequesterId: 8,
    };
    const byEmail = new Map<string, unknown>([[gatedUser.email, gatedUser]]);
    const byId = new Map<number, unknown>([
      [gatedUser.id, gatedUser],
      [adminUser.id, adminUser],
    ]);
    const findUnique = vi.fn(async (args: { where: { email?: string; id?: number } }) => {
      if (args.where.email !== undefined) return byEmail.get(args.where.email) ?? null;
      if (args.where.id !== undefined) return byId.get(args.where.id) ?? null;
      return null;
    });
    mockPrisma({
      user: { findUnique, findMany: vi.fn(async () => []), update: vi.fn() },
      ticket: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []) },
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "michael.chen@example.com", password: NEW_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.mustChangePassword).toBe(true);

    const cookie = (login.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
    const gated = await request(app).get("/api/tickets").set("Cookie", cookie as string);
    expect(gated.status).toBe(403);
    expect(gated.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("rejects weak passwords with 400 and unknown users with 404", async () => {
    const byId = new Map<number, unknown>([[adminUser.id, adminUser]]);
    mockPrisma({ user: userMock(byId) });

    const weak = await request(app)
      .post("/api/admin/users/11/initial-password")
      .set("Cookie", adminCookie())
      .send({ initialPassword: "weak" });
    expect(weak.status).toBe(400);

    const missing = await request(app)
      .post("/api/admin/users/9999/initial-password")
      .set("Cookie", adminCookie())
      .send({ initialPassword: NEW_PASSWORD });
    expect(missing.status).toBe(404);
  });
});

describe("admin authorization (FR-04)", () => {
  it("returns 403 for non-Administrator callers on every endpoint", async () => {
    const byId = new Map<number, unknown>([
      [requesterUser.id, requesterUser],
      [staffUser.id, staffUser],
    ]);
    mockPrisma({ user: userMock(byId) });

    for (const userId of [requesterUser.id, staffUser.id]) {
      const cookie = `toktickit_session=${createSession(userId)}`;
      expect((await request(app).get("/api/admin/users").set("Cookie", cookie)).status).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/admin/users")
            .set("Cookie", cookie)
            .send({ name: "X", email: "x@example.com", role: "REQUESTER", isActive: true, initialPassword: DEV_PASSWORD })
        ).status,
      ).toBe(403);
      expect(
        (await request(app).patch("/api/admin/users/11").set("Cookie", cookie).send({ name: "X" })).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/admin/users/11/initial-password")
            .set("Cookie", cookie)
            .send({ initialPassword: NEW_PASSWORD })
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/admin/users/11/reset-password")
            .set("Cookie", cookie)
            .send({ initialPassword: NEW_PASSWORD })
        ).status,
      ).toBe(403);
    }
  });

  it("returns 401 without a session", async () => {
    mockPrisma({ user: userMock(new Map()) });
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/admin/users")
          .send({ name: "X", email: "x@example.com", role: "REQUESTER", isActive: true, initialPassword: DEV_PASSWORD })
      ).status,
    ).toBe(401);
  });
});
