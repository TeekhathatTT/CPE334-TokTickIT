import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));

const staffUser = { id: 2, name: "Staff User", email: "staff@example.com", passwordHash: hashPassword("TokTickit1!"), role: "IT_STAFF", isActive: true, mustChangePassword: false, legacyRequesterId: null };
const requester = { ...staffUser, id: 1, email: "requester@example.com", role: "REQUESTER", legacyRequesterId: 10 };

const ticketSummary = { id: 1, ticketNumber: "TKT-0001", summary: "Printer not working", status: "NEW", requestedPriority: "MEDIUM", itPriority: null, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), ownerId: null, requester: { name: "Alice", email: "alice@example.com" } };

const prisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  ticket: { findMany: vi.fn(), count: vi.fn() },
};

const { app } = await import("../../src/app.js");

async function staffAgent() {
  prisma.user.findUnique.mockResolvedValue(staffUser);
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: staffUser.email, password: "TokTickit1!" });
  prisma.user.findFirst.mockResolvedValue(staffUser);
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(prisma as never);
  prisma.user.findFirst.mockResolvedValue(staffUser);
  prisma.user.findUnique.mockResolvedValue(staffUser);
  prisma.ticket.findMany.mockResolvedValue([ticketSummary]);
  prisma.ticket.count.mockResolvedValue(1);
});

describe("IT Staff queue API", () => {
  it("rejects unauthenticated and Requester access", async () => {
    expect((await request(app).get("/api/staff/tickets")).status).toBe(401);
    prisma.user.findUnique.mockResolvedValueOnce(requester);
    const rAgent = request.agent(app);
    await rAgent.post("/api/auth/login").send({ email: requester.email, password: "TokTickit1!" });
    prisma.user.findFirst.mockResolvedValue(requester);
    expect((await rAgent.get("/api/staff/tickets")).status).toBe(403);
  });

  it("returns ticket list with pagination meta on default request", async () => {
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets");
    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.meta).toHaveProperty("page");
    expect(response.body.meta).toHaveProperty("totalItems");
    expect(response.body.meta).toHaveProperty("queueTotal");
    expect(response.body.meta).toHaveProperty("isEmpty");
    expect(response.body.meta).toHaveProperty("isNoResults");
  });

  it("passes search query to the database filter", async () => {
    const agent = await staffAgent();
    await agent.get("/api/staff/tickets?search=printer");
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
    );
  });

  it("filters by status and itPriority", async () => {
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets?status=OPEN&itPriority=HIGH");
    expect(response.status).toBe(200);
    expect(prisma.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ itPriority: "HIGH" }),
      }),
    );
  });

  it("returns isEmpty true when no tickets exist", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValue(0);
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets");
    expect(response.status).toBe(200);
    expect(response.body.meta.isEmpty).toBe(true);
  });

  it("returns isNoResults true when filters match nothing but tickets exist", async () => {
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.ticket.count.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets?search=xyznotfound");
    expect(response.status).toBe(200);
    expect(response.body.meta.isNoResults).toBe(true);
  });

  it("silently falls back to page 1 for non-numeric page values (graceful default)", async () => {
    // server/src/staff.ts uses parsePositiveInt() which returns null for 'abc',
    // then falls back to page 1 rather than returning 400. Verify 200 + page 1.
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets?page=abc");
    expect(response.status).toBe(200);
    expect(response.body.meta.page).toBe(1);
  });

  it("silently ignores unknown sort fields and falls back to the default sort", async () => {
    // server/src/staff.ts validates sort against STAFF_SORTS; an unknown value
    // falls back to the default (updatedAt desc) rather than returning 400.
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets?sort=invalidField");
    expect(response.status).toBe(200);
    // The response must still have pagination meta
    expect(response.body.meta).toHaveProperty("page");
  });
});
