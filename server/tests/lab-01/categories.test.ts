import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { getPrisma } from "../../src/prisma.js";

vi.mock("../../src/prisma.js", () => ({
  getPrisma: vi.fn(),
}));

const { default: app } = await import("../../src/app.js");

describe("GET /api/categories", () => {
  it("returns the four seeded categories in id order", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      category: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, name: "Account and Access", isActive: true },
          { id: 2, name: "Hardware", isActive: true },
          { id: 3, name: "Software", isActive: true },
          { id: 4, name: "Network", isActive: true },
        ]),
      },
    } as never);

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { id: 1, name: "Account and Access", isActive: true },
        { id: 2, name: "Hardware", isActive: true },
        { id: 3, name: "Software", isActive: true },
        { id: 4, name: "Network", isActive: true },
      ],
    });
  });
});
