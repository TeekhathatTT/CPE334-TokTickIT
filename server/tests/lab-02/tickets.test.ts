import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const uploadDir = await fs.mkdtemp(
  path.join(os.tmpdir(), "toktickit-tickets-"),
);
process.env.UPLOAD_DIR = uploadDir;

const { default: app } = await import("../../src/app.js");

function mockPrisma(overrides: Record<string, unknown>) {
  vi.mocked(getPrisma).mockReturnValue(overrides as never);
}

const activeRequester = { id: 1, name: "Jennifer Anderson" };

afterAll(async () => {
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("POST /api/tickets", () => {
  it("creates a ticket and returns the generated ticket number", async () => {
    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      category: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 2, name: "Hardware", isActive: true }),
      },
      relatedSystem: {
        findFirst: vi.fn().mockResolvedValue({
          id: 3,
          name: "Corporate Laptop",
          isActive: true,
        }),
      },
      ticket: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 101,
          ticketNumber: "TKT-2026-000001",
          requesterId: 1,
          categoryId: 2,
          relatedSystemId: 3,
          summary: "Laptop battery drains quickly",
          description:
            "The battery drains within two hours of unplugging it.",
          requestedPriority: "MEDIUM",
          itPriority: null,
          status: "NEW",
          createdAt: new Date("2026-08-19T09:14:00Z"),
          attachments: [],
        }),
      },
    });

    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "3")
      .field("summary", "Laptop battery drains quickly")
      .field(
        "description",
        "The battery drains within two hours of unplugging it.",
      )
      .field("requestedPriority", "MEDIUM");

    expect(response.status).toBe(201);
    expect(response.body.data.ticketNumber).toBe("TKT-2026-000001");
    expect(response.body.data.status).toBe("NEW");
    expect(response.body.data.attachments).toEqual([]);
  });

  it("returns 401 when x-requester-id is missing", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .field("categoryId", "2")
      .field("relatedSystemId", "3")
      .field("summary", "Laptop battery drains quickly")
      .field(
        "description",
        "The battery drains within two hours of unplugging it.",
      )
      .field("requestedPriority", "MEDIUM");

    expect(response.status).toBe(401);
  });

  it("returns 400 with field errors when summary is too short", async () => {
    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
    });

    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "1")
      .field("categoryId", "2")
      .field("relatedSystemId", "3")
      .field("summary", "Hi")
      .field(
        "description",
        "The battery drains within two hours of unplugging it.",
      )
      .field("requestedPriority", "MEDIUM");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields.summary).toBeDefined();
  });

  it("returns 404 when categoryId does not reference an active category", async () => {
    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      category: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      relatedSystem: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 3, name: "Corporate Laptop" }),
      },
    });

    const response = await request(app)
      .post("/api/tickets")
      .set("x-requester-id", "1")
      .field("categoryId", "999")
      .field("relatedSystemId", "3")
      .field("summary", "Laptop battery drains quickly")
      .field(
        "description",
        "The battery drains within two hours of unplugging it.",
      )
      .field("requestedPriority", "MEDIUM");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/tickets", () => {
  it("returns only the requesting Requester's own tickets with pagination meta", async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(1) // totalItems for the filtered where clause
      .mockResolvedValueOnce(1); // totalAllTickets for the requester overall

    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      ticket: {
        count,
        findMany: vi.fn().mockResolvedValue([
          {
            id: 101,
            ticketNumber: "TKT-2026-000001",
            summary: "Laptop battery drains quickly",
            requestedPriority: "MEDIUM",
            itPriority: null,
            status: "NEW",
            createdAt: new Date("2026-08-19T09:14:00Z"),
            updatedAt: new Date("2026-08-19T09:14:00Z"),
            category: { name: "Hardware" },
          },
        ]),
      },
    });

    const response = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].category).toBe("Hardware");
    expect(response.body.meta).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      isEmpty: false,
      isNoResults: false,
    });
  });

  it("reports the empty state when the Requester has zero tickets", async () => {
    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      ticket: {
        count,
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const response = await request(app)
      .get("/api/tickets")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.meta.isEmpty).toBe(true);
    expect(response.body.meta.isNoResults).toBe(false);
  });

  it("reports the no-results state when a search matches nothing", async () => {
    const count = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(5);

    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      ticket: {
        count,
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const response = await request(app)
      .get("/api/tickets?search=doesnotexist")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.meta.isEmpty).toBe(false);
    expect(response.body.meta.isNoResults).toBe(true);
  });

  it("returns 401 when x-requester-id is missing", async () => {
    const response = await request(app).get("/api/tickets");
    expect(response.status).toBe(401);
  });
});

describe("GET /api/tickets/:id", () => {
  it("returns 404 for a ticket owned by a different Requester", async () => {
    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      ticket: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const response = await request(app)
      .get("/api/tickets/999")
      .set("x-requester-id", "1");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns full detail with active and removed attachments for an owned ticket", async () => {
    mockPrisma({
      requester: {
        findFirst: vi.fn().mockResolvedValue(activeRequester),
      },
      ticket: {
        findFirst: vi.fn().mockResolvedValue({
          id: 101,
          ticketNumber: "TKT-2026-000001",
          createdAt: new Date("2026-08-19T09:14:00Z"),
          category: { name: "Hardware" },
          relatedSystem: { name: "Corporate Laptop" },
          requester: { name: "Jennifer Anderson" },
          requestedPriority: "MEDIUM",
          itPriority: null,
          status: "NEW",
          ticketOwnerId: null,
          summary: "Laptop battery drains quickly",
          description:
            "The battery drains within two hours of unplugging it.",
          attachments: [
            {
              id: 501,
              originalFilename: "screenshot.png",
              sizeBytes: 240000,
              uploadedAt: new Date("2026-08-19T09:14:00Z"),
              removedAt: null,
              removalReason: null,
            },
            {
              id: 499,
              originalFilename: "old.pdf",
              sizeBytes: 120000,
              uploadedAt: new Date("2026-08-18T09:14:00Z"),
              removedAt: new Date("2026-08-19T10:00:00Z"),
              removalReason: "Wrong file attached",
            },
          ],
        }),
      },
    });

    const response = await request(app)
      .get("/api/tickets/101")
      .set("x-requester-id", "1");

    expect(response.status).toBe(200);
    expect(response.body.data.attachments.active).toHaveLength(1);
    expect(response.body.data.attachments.removed).toHaveLength(1);
    expect(response.body.data.attachments.removed[0].removalReason).toBe(
      "Wrong file attached",
    );
  });
});