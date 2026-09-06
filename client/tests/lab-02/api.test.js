import { afterEach, describe, expect, it, vi } from "vitest";
import { createTicket, getTickets } from "../../src/api";
afterEach(() => vi.restoreAllMocks());
describe("API requester contract", () => {
    it("sends requester identity as a header, never as a query parameter", async () => {
        const response = { ok: true, json: async () => ({ data: [] }) };
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
        await getTickets(42, { page: 2, pageSize: 20 });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).not.toContain("x-requester-id");
        expect(new Headers(init.headers).get("x-requester-id")).toBe("42");
    });
    it("adds the requester header to multipart ticket creation", async () => {
        const response = { ok: true, json: async () => ({ data: { id: 1 } }) };
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response);
        await createTicket({ categoryId: 1, relatedSystemId: 1, summary: "A valid summary", description: "A valid description", requestedPriority: "LOW", requesterId: 7 });
        expect(new Headers(fetchMock.mock.calls[0][1].headers).get("x-requester-id")).toBe("7");
    });
});
