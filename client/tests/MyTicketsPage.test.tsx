import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyTicketsPage from "../src/pages/MyTicketsPage";
import * as api from "../src/api";

const meta = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, isEmpty: false, isNoResults: false };
const row = { id: 101, ticketNumber: "TKT-2026-000101", summary: "Laptop problem", category: "Hardware", requestedPriority: "MEDIUM" as const, itPriority: null, status: "NEW" as const, createdAt: "2026-08-19T09:14:00Z", updatedAt: "2026-08-19T09:14:00Z" };

describe("MyTicketsPage", () => {
  it("renders tickets and clears active filters", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockResolvedValue({ data: [row], meta });
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    render(<MyTicketsPage requesterId={1} />);

    expect((await screen.findAllByText("TKT-2026-000101")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("textbox", { name: /search tickets/i }), { target: { value: "laptop" } });
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(1, expect.objectContaining({ search: "laptop" })));
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /search tickets/i })).toHaveValue(""));
  });

  it("renders the empty and no-results states", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getTickets").mockResolvedValueOnce({ data: [], meta: { ...meta, totalItems: 0, isEmpty: true } }).mockResolvedValueOnce({ data: [], meta: { ...meta, totalItems: 2, isNoResults: true } });
    const { unmount } = render(<MyTicketsPage requesterId={1} />);
    expect(await screen.findByText(/you have no tickets yet/i)).toBeInTheDocument();
    unmount();
    render(<MyTicketsPage requesterId={2} />);
    expect(await screen.findByText(/no tickets match your filters/i)).toBeInTheDocument();
  });
});