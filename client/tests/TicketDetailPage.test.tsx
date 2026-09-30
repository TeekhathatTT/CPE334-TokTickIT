import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TicketDetailPage from "../src/pages/TicketDetailPage";
import * as api from "../src/api";

afterEach(() => vi.restoreAllMocks());

const ticket = {
  id: 101, ticketNumber: "TKT-2026-000101", createdAt: "2026-08-19T09:14:00Z", category: "Hardware", relatedSystem: "Corporate Laptop", requester: "A User", requestedPriority: "MEDIUM", itPriority: null, status: "NEW", ticketOwner: null, summary: "Laptop problem", description: "The laptop has a problem.", problemAppearsResolvedAt: null,
  attachments: { active: [{ id: 501, originalFilename: "photo.png", sizeBytes: 1000, uploadedAt: "2026-08-19T09:14:00Z" }], removed: [{ id: 499, originalFilename: "old.pdf", sizeBytes: 1000, removedAt: "2026-08-19T10:00:00Z", removalReason: "Wrong file" }] },
};

const comments = [
  { id: 301, ticketId: 101, author: { id: 1, name: "A User", role: "REQUESTER" }, content: "Thanks for looking into this.", createdAt: "2026-08-19T10:00:00Z" },
];

describe("TicketDetailPage", () => {
  it("renders ticket information, removed files, and validates removal reason", async () => {
    // Lab 3: session identity — no requesterId argument; comments load too.
    const getTicket = vi.spyOn(api, "getTicket").mockResolvedValue(ticket as never);
    vi.spyOn(api, "getComments").mockResolvedValue(comments as never);
    render(<TicketDetailPage ticketId={101} />);
    expect(await screen.findByText("TKT-2026-000101")).toBeInTheDocument();
    expect(getTicket).toHaveBeenCalledWith(101);
    expect(screen.getByText("Laptop problem")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show removed/i }));
    expect(screen.getByText("old.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Wrong file" } });
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeEnabled();
  });

  it("renders the public comments thread and the resolved-signal action", async () => {
    vi.spyOn(api, "getTicket").mockResolvedValue(ticket as never);
    vi.spyOn(api, "getComments").mockResolvedValue(comments as never);
    const markResolved = vi.spyOn(api, "markProblemAppearsResolved").mockResolvedValue({
      ticketId: 101,
      problemAppearsResolvedAt: "2026-09-26T02:00:00Z",
    });
    render(<TicketDetailPage ticketId={101} />);

    expect(await screen.findByText("Thanks for looking into this.")).toBeInTheDocument();
    const action = screen.getByRole("button", { name: /problem appears resolved/i });
    fireEvent.click(action);
    await waitFor(() => expect(markResolved).toHaveBeenCalledWith(101));
    expect(await screen.findByText(/you marked this problem as appearing resolved/i)).toBeInTheDocument();
  });

  it("shows not found when loading fails", async () => {
    vi.spyOn(api, "getTicket").mockRejectedValue(new Error("Not found"));
    vi.spyOn(api, "getComments").mockResolvedValue([]);
    render(<TicketDetailPage ticketId={999} />);
    await waitFor(() => expect(screen.getByText("Ticket not found.")).toBeInTheDocument());
  });
});
