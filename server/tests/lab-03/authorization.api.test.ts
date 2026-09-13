import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));
const requester = { id: 1, name: "Requester", email: "requester@example.com", passwordHash: hashPassword("TokTickit1!"), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: 11 };
const staff = { ...requester, id: 2, email: "staff@example.com", role: "IT_STAFF", legacyRequesterId: null };
const prisma = { user: { findUnique: vi.fn(), findFirst: vi.fn() }, requester: { findFirst: vi.fn() }, ticket: { findFirst: vi.fn() } };
const { app } = await import("../../src/app.js");
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPrisma).mockReturnValue(prisma as never); prisma.user.findFirst.mockImplementation(async ({ where }: { where: { id: number } }) => where.id === staff.id ? staff : requester); prisma.user.findUnique.mockResolvedValue(requester); prisma.requester.findFirst.mockResolvedValue({ id: 11, name: "Requester" }); });

describe("authorization API", () => {
  it("rejects protected requester APIs without a session", async () => {
    const response = await request(app).get("/api/tickets");
    expect(response.status).toBe(401);
  });

  it("rejects a valid but wrong role", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(staff);
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: staff.email, password: "TokTickit1!" });
    const response = await agent.get("/api/tickets");
    expect(response.status).toBe(403);
  });

  it("does not use a spoofed requester header for ownership", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: requester.email, password: "TokTickit1!" });
    prisma.ticket.findFirst.mockResolvedValue(null);
    const response = await agent.get("/api/tickets/999").set("x-requester-id", "999");
    expect(response.status).toBe(404);
    expect(prisma.ticket.findFirst).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ requesterId: 999 }) }));
  });
});