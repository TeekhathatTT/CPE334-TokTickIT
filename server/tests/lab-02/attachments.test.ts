import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";
import {
  clearAllSessions,
  createSession,
} from "../../src/modules/auth/auth.service.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const uploadDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "toktickit-attachments-"),
);
process.env.UPLOAD_DIR = uploadDir;

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  // Lab 3: authenticated Requester session (see tickets.test.ts) replaces
  // the Lab 2 `x-requester-id` stand-in; attachment behavior is unchanged.
  const sessionUser = {
    id: 1,
    isActive: true,
    legacyRequesterId: 1,
    email: "jennifer.anderson@example.com",
    role: "REQUESTER",
    mustChangePassword: false,
  };
  vi.mocked(getPrisma).mockReturnValue({
    user: {
      findUnique: vi.fn().mockResolvedValue(sessionUser),
      findFirst: vi.fn().mockResolvedValue(sessionUser),
    },
    ...overrides,
  } as never);
}

function authCookie(): string {
  return `toktickit_session=${createSession(1)}`;
}

beforeEach(() => {
  clearAllSessions();
});

afterAll(async () => {
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("POST /api/tickets/:id/attachments", () => {
  it("returns 401 when the session user is inactive", async () => {
    // Lab 3 successor to the Lab 2 "inactive requester" case: deactivation
    // now lives on the session User, and the request is rejected before any
    // attachment or ownership check runs.
    const inactiveUser = {
      id: 1,
      isActive: false,
      legacyRequesterId: 1,
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      mustChangePassword: false,
    };
    mockPrisma({
      user: {
        findUnique: vi.fn().mockResolvedValue(inactiveUser),
        findFirst: vi.fn().mockResolvedValue(inactiveUser),
      },
      requester: {
        findFirst: vi.fn(),
      },
      ticket: {
        findFirst: vi.fn(),
      },
    });

    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("Cookie", authCookie())
      .attach("file", Buffer.from("%PDF-1.4 test file"), {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("adds an attachment to an owned ticket", async () => {
    mockPrisma({
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ id: 101 }),
      },
      attachment: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 502,
          originalFilename: "invoice.pdf",
          sizeBytes: 19,
          uploadedAt: new Date("2026-08-19T10:00:00Z"),
        }),
      },
    });

    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("Cookie", authCookie())
      .attach("file", Buffer.from("%PDF-1.4 test file"), {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.originalFilename).toBe("invoice.pdf");
  });

  it("returns 400 when the file type is not supported", async () => {
    mockPrisma({
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ id: 101 }),
      },
      attachment: {
        count: vi.fn().mockResolvedValue(0),
      },
    });

    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("Cookie", authCookie())
      .attach("file", Buffer.from("not a real docx"), {
        filename: "notes.docx",
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("UNSUPPORTED_TYPE");
  });

  it("returns 400 when the ticket already has 5 active attachments", async () => {
    mockPrisma({
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ id: 101 }),
      },
      attachment: {
        count: vi.fn().mockResolvedValue(5),
      },
    });

    const response = await request(app)
      .post("/api/tickets/101/attachments")
      .set("Cookie", authCookie())
      .attach("file", Buffer.from("%PDF-1.4 test file"), {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("LIMIT_REACHED");
  });

  it("returns 404 when the ticket is not owned by the requester", async () => {
    mockPrisma({
      ticket: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const response = await request(app)
      .post("/api/tickets/999/attachments")
      .set("Cookie", authCookie())
      .attach("file", Buffer.from("%PDF-1.4 test file"), {
        filename: "invoice.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/attachments/:id", () => {
  it("returns attachment metadata for an owned attachment", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          ticketId: 101,
          originalFilename: "screenshot.png",
          sizeBytes: 240000,
          uploadedAt: new Date("2026-08-19T09:14:00Z"),
          removedAt: null,
          removalReason: null,
        }),
      },
    });

    const response = await request(app)
      .get("/api/attachments/501")
      .set("Cookie", authCookie());

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(501);
  });

  it("returns 404 for an attachment not owned by the requester", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const response = await request(app)
      .get("/api/attachments/501")
      .set("Cookie", authCookie());

    expect(response.status).toBe(404);
  });
});

describe("GET /api/attachments/:id/download", () => {
  it("downloads an active attachment's file bytes", async () => {
    const storedFilename = "test-file.pdf";
    await fs.writeFile(
      path.join(uploadDir, storedFilename),
      "%PDF-1.4 test file",
    );

    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          storedFilename,
          originalFilename: "invoice.pdf",
          mimeType: "application/pdf",
          removedAt: null,
        }),
      },
    });

    const response = await request(app)
      .get("/api/attachments/501/download")
      .set("Cookie", authCookie());

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
  });

  it("returns 410 when the attachment has been soft-removed", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          storedFilename: "test-file.pdf",
          originalFilename: "invoice.pdf",
          mimeType: "application/pdf",
          removedAt: new Date("2026-08-19T10:00:00Z"),
        }),
      },
    });

    const response = await request(app)
      .get("/api/attachments/501/download")
      .set("Cookie", authCookie());

    expect(response.status).toBe(410);
  });

  it("returns 404 for an attachment not owned by the requester", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const response = await request(app)
      .get("/api/attachments/501/download")
      .set("Cookie", authCookie());

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/attachments/:id/remove", () => {
  it("soft-removes an owned, active attachment with a valid reason", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          removedAt: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 501,
          removedAt: new Date("2026-08-19T10:02:00Z"),
          removalReason: "Wrong file attached",
        }),
      },
    });

    const response = await request(app)
      .patch("/api/attachments/501/remove")
      .set("Cookie", authCookie())
      .send({ reason: "Wrong file attached" });

    expect(response.status).toBe(200);
    expect(response.body.data.removalReason).toBe("Wrong file attached");
  });

  it("returns 400 when the removal reason is too short", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          removedAt: null,
        }),
      },
    });

    const response = await request(app)
      .patch("/api/attachments/501/remove")
      .set("Cookie", authCookie())
      .send({ reason: "Hi" });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.reason).toBeDefined();
  });

  it("returns 409 when the attachment is already removed", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          removedAt: new Date("2026-08-19T10:02:00Z"),
        }),
      },
    });

    const response = await request(app)
      .patch("/api/attachments/501/remove")
      .set("Cookie", authCookie())
      .send({ reason: "Duplicate removal attempt" });

    expect(response.status).toBe(409);
  });

  it("returns 404 when the attachment is not owned by the requester", async () => {
    mockPrisma({
      attachment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const response = await request(app)
      .patch("/api/attachments/501/remove")
      .set("Cookie", authCookie())
      .send({ reason: "Wrong file attached" });

    expect(response.status).toBe(404);
  });
});