import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TicketQueuePage } from "../../src/pages/staff/TicketQueuePage";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

function row(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ticketNumber: `TKT-2026-${String(id).padStart(6, "0")}`,
    summary: `Laptop issue ${id}`,
    category: "Hardware",
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "NEW",
    owner: null,
    requester: { name: "Jennifer Anderson" },
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    ...overrides,
  };
}

function meta(overrides: Record<string, unknown> = {}) {
  return {
    page: 1, pageSize: 20, totalItems: 1, totalPages: 1,
    queueTotal: 1, isEmpty: false, isNoResults: false,
    ...overrides,
  };
}

describe("Lab 3 StaffTicketQueue", () => {
  it("renders the queue table with the ui-spec column set", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue({ data: [row(101)], meta: meta() });
    render(<TicketQueuePage />);

    expect((await screen.findAllByText("TKT-2026-000101")).length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    for (const header of ["Ticket No.", "Created Date", "Summary", "Category", "Requested Priority", "IT Priority", "Current Status", "Ticket Owner", "Last Updated"]) {
      expect(within(table).getByText(new RegExp(header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).toBeInTheDocument();
    }
  });

  it("passes search input through to the queue API", async () => {
    const loader = vi.spyOn(api, "getStaffTickets").mockResolvedValue({ data: [], meta: meta({ totalItems: 0, totalPages: 0, queueTotal: 1, isNoResults: true }) });
    render(<TicketQueuePage />);
    await screen.findByText(/no tickets match/i);

    fireEvent.change(screen.getByLabelText(/search queue/i), { target: { value: "laptop" } });

    await waitFor(() => {
      expect(loader).toHaveBeenCalledWith(expect.objectContaining({ search: "laptop" }));
    });
  });

  it("shows distinct empty, no-results, loading, and failure states", async () => {
    const loader = vi.spyOn(api, "getStaffTickets").mockResolvedValue({ data: [row(101)], meta: meta() });
    const { unmount } = render(<TicketQueuePage />);
    expect(screen.getByText(/loading ticket queue/i)).toBeInTheDocument();
    expect((await screen.findAllByText("TKT-2026-000101")).length).toBeGreaterThan(0);
    unmount();

    loader.mockResolvedValue({ data: [], meta: meta({ totalItems: 0, totalPages: 0, queueTotal: 0, isEmpty: true }) });
    render(<TicketQueuePage />);
    expect(await screen.findByText(/no tickets in the queue yet/i)).toBeInTheDocument();
  });

  it("shows no-results copy with a working clear-filters action", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue({
      data: [], meta: meta({ totalItems: 0, totalPages: 0, queueTotal: 5, isNoResults: true }),
    });
    render(<TicketQueuePage />);

    expect(await screen.findByText(/no tickets match your filters/i)).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: /clear filters/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);
    expect(screen.getByLabelText(/search queue/i)).toHaveValue("");
  });

  it("shows a retryable failure state when the API rejects", async () => {
    const loader = vi
      .spyOn(api, "getStaffTickets")
      .mockRejectedValueOnce(new api.ApiError(500, "INTERNAL_ERROR", "Unable to fetch tickets"))
      .mockResolvedValue({ data: [row(101)], meta: meta() });
    render(<TicketQueuePage />);

    expect(await screen.findByText("Unable to fetch tickets")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect((await screen.findAllByText("TKT-2026-000101")).length).toBeGreaterThan(0);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("opens the detail view when a ticket number is clicked", async () => {
    vi.spyOn(api, "getStaffTickets").mockResolvedValue({ data: [row(101)], meta: meta() });
    const onSelectTicket = vi.fn();
    render(<TicketQueuePage onSelectTicket={onSelectTicket} />);

    const matches = await screen.findAllByText("TKT-2026-000101");
    fireEvent.click(matches[0]);
    expect(onSelectTicket).toHaveBeenCalledWith(101);
  });
});
