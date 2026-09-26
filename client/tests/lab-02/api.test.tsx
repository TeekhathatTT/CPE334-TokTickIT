import { afterEach, describe, expect, it, vi } from "vitest";
import { createTicket, getTickets } from "../../src/api";

afterEach(() => vi.restoreAllMocks());

describe("API session contract (Lab 3 successor to the header contract)", () => {
  it("sends the session cookie instead of any requester identity header", async () => {
    const response = { ok: true, json: async () => ({ data: [], meta: {} }) } as Response;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await getTickets({ page: 2, pageSize: 20 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("x-requester-id");
    expect(String(url)).not.toContain("requesterId");
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("x-requester-id")).toBeNull();
    expect((init as RequestInit).credentials).toBe("include");
  });

  it("creates tickets without a requesterId field or header", async () => {
    const response = { ok: true, json: async () => ({ data: { id: 1 } }) } as Response;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    await createTicket({ categoryId: 1, relatedSystemId: 1, summary: "A valid summary", description: "A valid description", requestedPriority: "LOW" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers((init as RequestInit).headers);
    expect(headers.get("x-requester-id")).toBeNull();
    const body = (init as RequestInit).body as FormData;
    expect(body.get("requesterId")).toBeNull();
    expect(body.get("summary")).toBe("A valid summary");
  });
});
