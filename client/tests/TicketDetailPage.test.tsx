import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TicketDetailPage from "../src/pages/TicketDetailPage";
import * as api from "../src/api";

const ticket = {
  id: 101, ticketNumber: "TKT-2026-000101", createdAt: "2026-08-19T09:14:00Z", category: "Hardware", relatedSystem: "Corporate Laptop", requester: "A User", requestedPriority: "MEDIUM", itPriority: null, status: "NEW", ticketOwner: null, summary: "Laptop problem", description: "The laptop has a problem.",
  attachments: { active: [{ id: 501, originalFilename: "photo.png", sizeBytes: 1000, uploadedAt: "2026-08-19T09:14:00Z" }], removed: [{ id: 499, originalFilename: "old.pdf", sizeBytes: 1000, removedAt: "2026-08-19T10:00:00Z", removalReason: "Wrong file" }] },
};

describe("TicketDetailPage", () => {
  it("renders ticket information, removed files, and validates removal reason", async () => {
    vi.spyOn(api, "getTicket").mockResolvedValue(ticket as never);
    render(<TicketDetailPage ticketId={101} requesterId={1} />);
    expect(await screen.findByText("TKT-2026-000101")).toBeInTheDocument();
    expect(screen.getByText("Laptop problem")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show removed/i }));
    expect(screen.getByText("old.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /remove$/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Wrong file" } });
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeEnabled();
  });

  it("shows not found when loading fails", async () => {
    vi.spyOn(api, "getTicket").mockRejectedValue(new Error("Not found"));
    render(<TicketDetailPage ticketId={999} requesterId={1} />);
    await waitFor(() => expect(screen.getByText("Ticket not found.")).toBeInTheDocument());
  });
});