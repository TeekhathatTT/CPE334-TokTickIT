import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));
const passwordHash = hashPassword("TokTickit1!");
const admin = { id: 1, name: "Admin", email: "admin@example.com", passwordHash, role: "ADMINISTRATOR", isActive: true, mustChangePassword: false, legacyRequesterId: null };
const requester = { ...admin, id: 2, email: "requester@example.com", role: "REQUESTER" };
const staff = { ...admin, id: 3, email: "staff@example.com", role: "IT_STAFF" };
const managed = { ...admin, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z") };
const prisma = { user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() }, $transaction: vi.fn() };
const { app } = await import("../../src/app.js");

async function agentFor(user: typeof admin) {
  prisma.user.findUnique.mockResolvedValue(user);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: user.email, password: "TokTickit1!" });
  prisma.user.findFirst.mockResolvedValue(user);
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(prisma as never);
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  prisma.user.findUnique.mockResolvedValue(managed);
  prisma.user.findFirst.mockResolvedValue(admin);
  prisma.user.findMany.mockResolvedValue([managed]);
  prisma.user.create.mockResolvedValue({ ...managed, id: 4, email: "new@example.com" });
  prisma.user.update.mockResolvedValue(managed);
  prisma.user.count.mockResolvedValue(2);
});

describe("administrator user management API", () => {
  it("rejects unauthenticated, requester, and IT staff access", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
    expect((await (await agentFor(requester)).get("/api/admin/users")).status).toBe(403);
    expect((await (await agentFor(staff)).post("/api/admin/users").send({})).status).toBe(403);
  });

  it("lists safe users and supports search and role filters", async () => {
    const response = await (await agentFor(admin)).get("/api/admin/users?search=adm&role=ADMINISTRATOR");
    expect(response.status).toBe(200);
    expect(response.body.data[0]).not.toHaveProperty("passwordHash");
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: "ADMINISTRATOR" }) }));
  });

  it("creates a user with a hash and required password change", async () => {
    const response = await (await agentFor(admin)).post("/api/admin/users").send({ name: "New User", email: "NEW@EXAMPLE.COM", role: "REQUESTER", isActive: true, initialPassword: "ValidPass1!" });
    expect(response.status).toBe(201);
    const input = prisma.user.create.mock.calls[0][0].data;
    expect(input.email).toBe("new@example.com");
    expect(input.mustChangePassword).toBe(true);
    expect(verifyPassword("ValidPass1!", input.passwordHash)).toBe(true);
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("rejects invalid roles, duplicate emails, and invalid passwords", async () => {
    const agent = await agentFor(admin);
    expect((await agent.post("/api/admin/users").send({ name: "X", email: "x@example.com", role: "ADMIN", isActive: true, initialPassword: "ValidPass1!" })).status).toBe(400);
    prisma.user.create.mockRejectedValueOnce({ code: "P2002" });
    expect((await agent.post("/api/admin/users").send({ name: "X", email: "x@example.com", role: "REQUESTER", isActive: true, initialPassword: "ValidPass1!" })).status).toBe(409);
    expect((await agent.post("/api/admin/users").send({ name: "X", email: "x@example.com", role: "REQUESTER", isActive: true, initialPassword: "weak" })).status).toBe(400);
  });

  it("updates users, rejects missing users, self-deactivation, and last-admin removal", async () => {
    const agent = await agentFor(admin);
    expect((await agent.patch("/api/admin/users/1").send({ name: "Updated" })).status).toBe(200);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect((await agent.patch("/api/admin/users/999").send({ name: "Missing" })).status).toBe(404);
    prisma.user.findUnique.mockResolvedValue(managed);
    expect((await agent.patch("/api/admin/users/1").send({ isActive: false })).body.error.code).toBe("SELF_DEACTIVATION");
    prisma.user.findUnique.mockResolvedValue({ id: 9, role: "ADMINISTRATOR", isActive: true }); prisma.user.count.mockResolvedValueOnce(1);
    expect((await agent.patch("/api/admin/users/9").send({ isActive: false })).body.error.code).toBe("LAST_ACTIVE_ADMIN");
  });

  it("sets a hashed initial password without returning it", async () => {
    const response = await (await agentFor(admin)).post("/api/admin/users/2/initial-password").send({ initialPassword: "ResetPass1!" });
    expect(response.status).toBe(200);
    const input = prisma.user.update.mock.calls[0][0].data;
    expect(verifyPassword("ResetPass1!", input.passwordHash)).toBe(true);
    expect(input.mustChangePassword).toBe(true);
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });
});
