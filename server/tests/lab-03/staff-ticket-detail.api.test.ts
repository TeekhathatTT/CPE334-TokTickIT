import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));

const staffUser = { id: 2, name: "Staff User", email: "staff@example.com", passwordHash: hashPassword("TokTickit1!"), role: "IT_STAFF", isActive: true, mustChangePassword: false, legacyRequesterId: null };

const fullTicket = {
  id: 1,
  ticketNumber: "TKT-0001",
  summary: "Printer not working",
  description: "The office printer fails to print.",
  status: "NEW",
  requestedPriority: "MEDIUM",
  itPriority: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ownerId: null,
  owner: null,
  problemAppearsResolvedAt: null,
  requester: { id: 1, name: "Alice", email: "alice@example.com" },
  category: { id: 1, name: "Hardware" },
  attachments: [],
  publicComments: [],
  internalNotes: [{ id: 1, content: "Checked driver — outdated.", createdAt: new Date("2026-01-02T00:00:00Z"), author: { id: 2, name: "Staff User", role: "IT_STAFF" } }],
};

const prisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  ticket: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  internalNote: { create: vi.fn() },
};

const { app } = await import("../../src/app.js");

async function staffAgent() {
  prisma.user.findUnique.mockResolvedValueOnce(staffUser);
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
  prisma.ticket.findFirst.mockResolvedValue(fullTicket);
  prisma.ticket.findUnique.mockResolvedValue(fullTicket);
  prisma.ticket.update.mockResolvedValue(fullTicket);
  prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
});

describe("IT Staff ticket detail API", () => {
  it("rejects unauthenticated access to ticket detail", async () => {
    expect((await request(app).get("/api/staff/tickets/1")).status).toBe(401);
  });

  it("returns full ticket detail including internal notes for IT Staff", async () => {
    const agent = await staffAgent();
    const response = await agent.get("/api/staff/tickets/1");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty("ticketNumber");
    expect(response.body.data).toHaveProperty("requester");
    expect(response.body.data).toHaveProperty("internalNotes");
    expect(response.body.data.internalNotes).toBeInstanceOf(Array);
  });

  it("returns 404 for a non-existent ticket", async () => {
    prisma.ticket.findFirst.mockResolvedValueOnce(null);
    const agent = await staffAgent();
    expect((await agent.get("/api/staff/tickets/999")).status).toBe(404);
  });

  it("assigns a ticket to a staff user and returns updated ticket", async () => {
    const updatedTicket = {
      ...fullTicket,
      ticketOwnerId: 2,
      ticketOwner: { id: 2, name: "Staff User", role: "IT_STAFF", email: "staff@example.com" },
      relatedSystem: null,
    };
    // user.findFirst is called twice: once for session auth, once for owner validation
    prisma.user.findFirst.mockResolvedValue(staffUser);
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    prisma.ticket.findUnique.mockResolvedValue(updatedTicket);
    const agent = await staffAgent();
    const response = await agent.patch("/api/staff/tickets/1/assignment").send({ ownerId: 2 });
    expect(response.status).toBe(200);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketOwnerId: 2 }) }),
    );
  });

  it("unassigns a ticket when ownerId is null", async () => {
    const updatedTicket = {
      ...fullTicket,
      ticketOwnerId: null,
      ticketOwner: null,
      relatedSystem: null,
    };
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    prisma.ticket.findUnique.mockResolvedValue(updatedTicket);
    const agent = await staffAgent();
    const response = await agent.patch("/api/staff/tickets/1/assignment").send({ ownerId: null });
    expect(response.status).toBe(200);
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketOwnerId: null }) }),
    );
  });

  it("updates itPriority and returns 200", async () => {
    const agent = await staffAgent();
    const response = await agent.patch("/api/staff/tickets/1/priority").send({ itPriority: "HIGH" });
    expect(response.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ itPriority: "HIGH" }) }),
    );
  });

  it("rejects invalid itPriority values with 400", async () => {
    const agent = await staffAgent();
    expect((await agent.patch("/api/staff/tickets/1/priority").send({ itPriority: "URGENT" })).status).toBe(400);
  });

  it("transitions status from NEW to OPEN", async () => {
    const agent = await staffAgent();
    const response = await agent.patch("/api/staff/tickets/1/status").send({ status: "OPEN" });
    expect(response.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "OPEN" }) }),
    );
  });

  it("rejects an invalid status transition with 409", async () => {
    // NEW cannot transition to RESOLVED directly
    const agent = await staffAgent();
    expect((await agent.patch("/api/staff/tickets/1/status").send({ status: "RESOLVED" })).status).toBe(409);
  });

  it("creates an internal note and returns 201", async () => {
    prisma.internalNote.create.mockResolvedValueOnce({
      id: 1,
      ticketId: 1,
      content: "Escalated to vendor.",
      createdAt: new Date(),
      author: { id: 2, name: "Staff User", role: "IT_STAFF" },
    });
    const agent = await staffAgent();
    const response = await agent.post("/api/staff/tickets/1/notes").send({ content: "Escalated to vendor." });
    expect(response.status).toBe(201);
    expect(prisma.internalNote.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ticketId: 1, authorId: 2 }) }),
    );
  });

  it("rejects blank internal notes with 400", async () => {
    const agent = await staffAgent();
    expect((await agent.post("/api/staff/tickets/1/notes").send({ content: "   " })).status).toBe(400);
  });
});
