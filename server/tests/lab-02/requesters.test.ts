import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

describe("GET /api/requesters", () => {
  it("returns active requesters only", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      requester: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: "Jennifer Anderson",
            email: "jennifer.anderson@example.com",
          },
          {
            id: 2,
            name: "Michael Chen",
            email: "michael.chen@example.com",
          },
        ]),
      },
    } as never);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      data: [
        {
          id: 1,
          name: "Jennifer Anderson",
          email: "jennifer.anderson@example.com",
        },
        {
          id: 2,
          name: "Michael Chen",
          email: "michael.chen@example.com",
        },
      ],
    });

    expect(getPrisma().requester.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: [
        { name: "asc" },
        { id: "asc" },
      ],
    });
  });

  it("returns a safe 500 response when the database fails", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      requester: {
        findMany: vi.fn().mockRejectedValue(
          new Error("database failure")
        ),
      },
    } as never);

    const response = await request(app).get("/api/requesters");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch requesters",
      },
    });
  });
});