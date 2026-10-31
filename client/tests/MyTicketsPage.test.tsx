import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MyTicketsPage from "../src/pages/MyTicketsPage";
import * as api from "../src/api";

afterEach(() => vi.restoreAllMocks());

const meta = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1, isEmpty: false, isNoResults: false };
const row = { id: 101, ticketNumber: "TKT-2026-000101", summary: "Laptop problem", category: "Hardware", requestedPriority: "MEDIUM" as const, itPriority: null, status: "NEW" as const, createdAt: "2026-08-19T09:14:00Z", updatedAt: "2026-08-19T09:14:00Z" };

describe("MyTicketsPage", () => {
  it("renders tickets and clears active filters", async () => {
    // Lab 3: identity comes from the session — no requesterId argument.
    const getTickets = vi.spyOn(api, "getTickets").mockResolvedValue({ data: [row], meta });
    vi.spyOn(api, "getCategories").mockResolvedValue([{ id: 1, name: "Hardware" }]);
    render(<MyTicketsPage />);

    expect((await screen.findAllByText("TKT-2026-000101")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("textbox", { name: /search tickets/i }), { target: { value: "laptop" } });
    await waitFor(() => expect(getTickets).toHaveBeenLastCalledWith(expect.objectContaining({ search: "laptop" })));
    expect(getTickets.mock.calls[0][0]).not.toHaveProperty("requesterId");
    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /search tickets/i })).toHaveValue(""));
  });

  it("applies and shows Dashboard status and date drill-down filters", async () => {
    const getTickets = vi.spyOn(api, "getTickets").mockResolvedValue({ data: [row], meta });
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    render(
      <MyTicketsPage
        initialFilters={{ status: ["RESOLVED", "CLOSED"], updatedSince: "2026-09-09T12:00:00.000Z" }}
      />,
    );

    await screen.findAllByText("TKT-2026-000101");
    await waitFor(() => {
      expect(getTickets).toHaveBeenCalledWith(expect.objectContaining({
        status: ["RESOLVED", "CLOSED"],
        updatedSince: "2026-09-09T12:00:00.000Z",
      }));
    });
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Statuses: Resolved, Closed");
    expect(screen.getByLabelText("Active filters")).toHaveTextContent("Updated since 09 Sept 2026");
    expect(screen.getByRole("combobox", { name: "Ticket status" })).toHaveDisplayValue("Preset statuses (2)");
  });

  it("renders the empty and no-results states", async () => {
    vi.spyOn(api, "getCategories").mockResolvedValue([]);
    vi.spyOn(api, "getTickets").mockResolvedValueOnce({ data: [], meta: { ...meta, totalItems: 0, isEmpty: true } }).mockResolvedValueOnce({ data: [], meta: { ...meta, totalItems: 2, isNoResults: true } });
    const { unmount } = render(<MyTicketsPage />);
    expect(await screen.findByText(/you have no tickets yet/i)).toBeInTheDocument();
    unmount();
    render(<MyTicketsPage />);
    expect(await screen.findByText(/no tickets match your filters/i)).toBeInTheDocument();
  });
});
