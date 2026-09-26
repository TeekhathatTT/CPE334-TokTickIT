import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";
import { validateNoteContent } from "../../src/modules/notes/notes.service.js";
import { clearAllSessions, createSession } from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

const staffUser = {
  id: 21,
  name: "Priya Patel",
  email: "priya.patel@example.com",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};

const adminUser = {
  id: 31,
  name: "Alice Admin",
  email: "alice.admin@example.com",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
};

const requesterUser = {
  id: 11,
  name: "Jennifer Anderson",
  email: "jennifer.anderson@example.com",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  legacyRequesterId: 7,
};

const SECRET_NOTE = "Candidate for weekend maintenance window";

function noteMocks(sessionUser: Record<string, unknown>) {
  const stored = {
    id: 501,
    ticketId: 101,
    content: SECRET_NOTE,
    createdAt: new Date("2026-09-26T03:00:00Z"),
    author: { id: sessionUser.id, name: sessionUser.name, role: sessionUser.role },
  };
  return {
    user: { findUnique: vi.fn(async () => sessionUser) },
    requester: { findUnique: vi.fn(async () => ({ id: 7 })) },
    ticket: {
      findFirst: vi.fn(async () => ({ id: 101 })),
      findUnique: vi.fn(async () => ({ id: 101 })),
    },
    internalNote: {
      create: vi.fn(async () => stored),
      findMany: vi.fn(async () => [stored]),
    },
    publicComment: {
      create: vi.fn(async () => ({
        id: 301,
        ticketId: 101,
        content: "Staff update for the requester.",
        createdAt: new Date("2026-09-26T04:00:00Z"),
        author: { id: sessionUser.id, name: sessionUser.name, role: sessionUser.role },
      })),
    },
  };
}

function cookieFor(userId: number): string {
  return `toktickit_session=${createSession(userId)}`;
}

beforeEach(() => {
  clearAllSessions();
  vi.restoreAllMocks();
});

describe("internal notes for permitted roles (AC-09)", () => {
  it("lets IT Staff post and list notes", async () => {
    mockPrisma(noteMocks(staffUser));

    const posted = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookieFor(staffUser.id))
      .send({ content: SECRET_NOTE });
    expect(posted.status).toBe(201);
    expect(posted.body.data).toMatchObject({ ticketId: 101, content: SECRET_NOTE });

    const listed = await request(app)
      .get("/api/staff/tickets/101/notes")
      .set("Cookie", cookieFor(staffUser.id));
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
  });

  it("lets Administrators post and list notes", async () => {
    mockPrisma(noteMocks(adminUser));

    const posted = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookieFor(adminUser.id))
      .send({ content: SECRET_NOTE });
    expect(posted.status).toBe(201);

    const listed = await request(app)
      .get("/api/staff/tickets/101/notes")
      .set("Cookie", cookieFor(adminUser.id));
    expect(listed.status).toBe(200);
  });

  it("rejects blank and over-long notes with 400 (append-only, BR-14)", async () => {
    mockPrisma(noteMocks(staffUser));
    const cookie = cookieFor(staffUser.id);

    const blank = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookie)
      .send({ content: "   " });
    expect(blank.status).toBe(400);

    const tooLong = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookie)
      .send({ content: "x".repeat(2001) });
    expect(tooLong.status).toBe(400);
  });

  it("returns 404 for notes on a missing ticket", async () => {
    mockPrisma({
      user: { findUnique: vi.fn(async () => staffUser) },
      ticket: { findFirst: vi.fn(async () => null) },
    });
    const response = await request(app)
      .get("/api/staff/tickets/4242/notes")
      .set("Cookie", cookieFor(staffUser.id));
    expect(response.status).toBe(404);
  });
});

describe("requester internal-note access is denied with no leakage (AC-04)", () => {
  it("returns 403 with no note content or count for Requesters", async () => {
    mockPrisma(noteMocks(requesterUser));
    const cookie = cookieFor(requesterUser.id);

    const listed = await request(app).get("/api/staff/tickets/101/notes").set("Cookie", cookie);
    expect(listed.status).toBe(403);
    expect(listed.body.error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(listed.body)).not.toContain(SECRET_NOTE);
    expect(listed.body.data).toBeUndefined();

    const posted = await request(app)
      .post("/api/staff/tickets/101/notes")
      .set("Cookie", cookie)
      .send({ content: "Trying to reach the private thread" });
    expect(posted.status).toBe(403);
    expect(JSON.stringify(posted.body)).not.toContain(SECRET_NOTE);
    expect(posted.body.data).toBeUndefined();
  });
});

describe("staff public comments (AC-09)", () => {
  it("lets IT Staff post on the public thread", async () => {
    mockPrisma(noteMocks(staffUser));

    const response = await request(app)
      .post("/api/tickets/101/comments")
      .set("Cookie", cookieFor(staffUser.id))
      .send({ content: "Staff update for the requester." });

    expect(response.status).toBe(201);
    expect(response.body.data.author.role).toBe("IT_STAFF");
  });
});

describe("note validator unit (BR-14)", () => {
  it("rejects empty/whitespace and over-2000-char content", () => {
    expect(validateNoteContent("   ").ok).toBe(false);
    expect(validateNoteContent("x".repeat(2001)).ok).toBe(false);
    expect(validateNoteContent("Shift handover note.").ok).toBe(true);
  });
});
