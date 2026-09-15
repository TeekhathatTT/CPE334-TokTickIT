import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));
const user = { id: 1, name: "Requester", email: "requester@example.com", passwordHash: hashPassword("TokTickit1!"), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: 11 };
const prisma = { user: { findUnique: vi.fn(), findFirst: vi.fn() }, ticket: { findFirst: vi.fn(), update: vi.fn() }, publicComment: { findMany: vi.fn(), create: vi.fn() } };
const { app } = await import("../../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(prisma as never);
  prisma.user.findUnique.mockResolvedValue(user);
  prisma.user.findFirst.mockResolvedValue(user);
  prisma.ticket.findFirst.mockResolvedValue({ id: 101, problemAppearsResolvedAt: null });
  prisma.publicComment.findMany.mockResolvedValue([]);
});

async function authenticatedAgent() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: user.email, password: "TokTickit1!" });
  return agent;
}

describe("Requester collaboration API", () => {
  it("lists and creates owned public comments", async () => {
    const agent = await authenticatedAgent();
    prisma.publicComment.create.mockResolvedValue({ id: 1, ticketId: 101, content: "It is working now.", createdAt: new Date("2026-09-13T10:00:00Z"), author: { id: 1, name: user.name, role: user.role } });
    const response = await agent.post("/api/tickets/101/comments").send({ content: "It is working now." });
    expect(response.status).toBe(201);
    expect(response.body.data.author.name).toBe(user.name);
    expect(prisma.publicComment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ticketId: 101, authorId: 1 }) }));
  });

  it("rejects blank or overlong comments", async () => {
    const agent = await authenticatedAgent();
    const response = await agent.post("/api/tickets/101/comments").send({ content: "   " });
    expect(response.status).toBe(400);
    expect(prisma.publicComment.create).not.toHaveBeenCalled();
  });

  it("records problem appears resolved without changing ticket status", async () => {
    const agent = await authenticatedAgent();
    prisma.ticket.update.mockResolvedValue({ id: 101, problemAppearsResolvedAt: new Date("2026-09-13T10:00:00Z") });
    const response = await agent.post("/api/tickets/101/problem-appears-resolved");
    expect(response.status).toBe(200);
    expect(response.body.data.ticketId).toBe(101);
    expect(prisma.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: { problemAppearsResolvedAt: expect.any(Date) } }));
  });

  it("hides comments for a ticket owned by someone else", async () => {
    const agent = await authenticatedAgent();
    prisma.ticket.findFirst.mockResolvedValue(null);
    const response = await agent.get("/api/tickets/999/comments");
    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("data");
  });
});
