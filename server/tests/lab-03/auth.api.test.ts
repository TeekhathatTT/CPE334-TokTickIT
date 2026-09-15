import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));
const user = { id: 1, name: "Jennifer Anderson", email: "jennifer@example.com", passwordHash: hashPassword("TokTickit1!"), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: 1 };
const prisma = { user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() } };
const { app } = await import("../../src/app.js");

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPrisma).mockReturnValue(prisma as never); prisma.user.findUnique.mockResolvedValue(user); prisma.user.findFirst.mockResolvedValue(user); });

describe("authentication API", () => {
  it("logs in and returns only safe user data", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: user.email, password: "TokTickit1!" });
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"][0]).toContain("toktickit_session=");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(response.body.data.user.email).toBe(user.email);
  });

  it("uses one generic response for invalid credentials", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const response = await request(app).post("/api/auth/login").send({ email: "unknown@example.com", password: "TokTickit1!" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_FAILED");
  });

  it("rejects current-user access without a session", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("invalidates a session on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: user.email, password: "TokTickit1!" });
    expect((await agent.get("/api/auth/me")).status).toBe(200);
    expect((await agent.post("/api/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });
});