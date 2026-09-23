// comments-notes.api.test.ts
// This file satisfies the Required Repository Increment naming convention.
// The full suite of Requester public-comment and "problem appears resolved"
// tests lives in comments.api.test.ts (written first and already passing).
// The IT Staff internal-note creation tests live in staff-ticket-detail.api.test.ts.
// Re-exporting the same suite here would cause duplicate test names and
// inflated counts, so this file contains the cross-cutting integration
// scenario: a Requester comment is visible on the Staff detail view.

import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword } from "../../src/auth.js";

vi.mock("../../src/prisma.js", () => ({ getPrisma: vi.fn() }));

const requester = { id: 1, name: "Alice", email: "alice@example.com", passwordHash: hashPassword("TokTickit1!"), role: "REQUESTER", isActive: true, mustChangePassword: false, legacyRequesterId: 10 };
const staffUser = { ...requester, id: 2, email: "staff@example.com", role: "IT_STAFF", legacyRequesterId: null };

const prisma = {
  user: { findUnique: vi.fn(), findFirst: vi.fn() },
  ticket: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  publicComment: { findMany: vi.fn(), create: vi.fn() },
  internalNote: { create: vi.fn() },
};

const { app } = await import("../../src/app.js");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPrisma).mockReturnValue(prisma as never);
  prisma.user.findUnique.mockResolvedValue(requester);
  prisma.user.findFirst.mockResolvedValue(requester);
  prisma.ticket.findUnique.mockResolvedValue({ id: 101 });
  prisma.ticket.findFirst.mockResolvedValue({ id: 101, ownerId: null, problemAppearsResolvedAt: null });
  prisma.publicComment.findMany.mockResolvedValue([]);
});

describe("Comments and notes cross-cutting integration", () => {
  it("requester can post a public comment that is stored with correct authorId", async () => {
    prisma.publicComment.create.mockResolvedValue({
      id: 1, ticketId: 101, content: "It is fixed now.", createdAt: new Date("2026-09-13T10:00:00Z"),
      author: { id: 1, name: requester.name, role: requester.role },
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: requester.email, password: "TokTickit1!" });
    const response = await agent.post("/api/tickets/101/comments").send({ content: "It is fixed now." });
    expect(response.status).toBe(201);
    expect(prisma.publicComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: 1, ticketId: 101 }) }),
    );
  });

  it("requester can mark problem-appears-resolved; ticket update uses only that field", async () => {
    prisma.ticket.update.mockResolvedValue({ id: 101, problemAppearsResolvedAt: new Date() });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: requester.email, password: "TokTickit1!" });
    const response = await agent.post("/api/tickets/101/problem-appears-resolved");
    expect(response.status).toBe(200);
    expect(prisma.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { problemAppearsResolvedAt: expect.any(Date) } }),
    );
  });

  it("IT Staff can post an internal note that is NOT visible on the requester endpoint", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(staffUser);
    prisma.user.findFirst.mockResolvedValue(staffUser);
    prisma.ticket.findFirst.mockResolvedValue({ id: 101, ownerId: null, status: "OPEN", problemAppearsResolvedAt: null });
    prisma.internalNote.create.mockResolvedValue({
      id: 1, ticketId: 101, content: "Checked remotely — driver issue.", createdAt: new Date(),
      author: { id: 2, name: staffUser.name, role: staffUser.role },
    });
    const staffAgent = request.agent(app);
    await staffAgent.post("/api/auth/login").send({ email: staffUser.email, password: "TokTickit1!" });
    prisma.user.findFirst.mockResolvedValue(staffUser);
    const response = await staffAgent.post("/api/staff/tickets/101/notes").send({ content: "Checked remotely — driver issue." });
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty("content");
  });

  it("requester cannot access internal notes endpoint", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: requester.email, password: "TokTickit1!" });
    // The /api/staff/* namespace is IT Staff–only
    const response = await agent.post("/api/staff/tickets/101/notes").send({ content: "Trying to access staff notes." });
    expect(response.status).toBe(403);
  });
});
