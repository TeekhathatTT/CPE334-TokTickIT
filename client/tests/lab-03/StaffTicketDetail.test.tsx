import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffTicketDetailPage } from "../../src/pages/staff/StaffTicketDetailPage";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

function detail(overrides: Partial<api.StaffTicketDetail> = {}): api.StaffTicketDetail {
  return {
    id: 101,
    ticketNumber: "TKT-2026-000101",
    summary: "Laptop battery drains quickly",
    description: "Full description",
    category: "Hardware",
    relatedSystem: "Corporate Laptop",
    requester: { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", userId: 11 },
    owner: null,
    requestedPriority: "MEDIUM",
    itPriority: null,
    status: "OPEN",
    problemAppearsResolvedAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    attachments: [],
    publicComments: [],
    internalNotes: [],
    permittedActions: { allowedStatuses: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"] },
    ...overrides,
  };
}

function renderDetail(props: Record<string, unknown> = {}) {
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
  render(<StaffTicketDetailPage ticketId={101} currentUserId={21} {...props} />);
}

describe("Lab 3 StaffTicketDetail", () => {
  it("renders ownership, priority, and status controls", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail());
    renderDetail();

    expect(await screen.findByText("TKT-2026-000101")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /claim \(assign to me\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^unassign$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^it priority$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/change status/i)).toBeInTheDocument();
  });

  it("claims the ticket for the current user", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail());
    const assign = vi
      .spyOn(api, "assignStaffTicket")
      .mockResolvedValue(detail({ owner: { id: 21, name: "Priya Patel" } }));
    renderDetail();

    fireEvent.click(await screen.findByRole("button", { name: /claim \(assign to me\)/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(101, 21));
    expect(await screen.findByText(/ticket claimed/i)).toBeInTheDocument();
  });

  it("offers only permitted next statuses, never the full enum", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail());
    renderDetail();

    const select = (await screen.findByLabelText(/change status/i)) as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);
    expect(options).toEqual(
      expect.arrayContaining(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]),
    );
    expect(options).not.toContain("CLOSED");
  });

  it("keeps public comments and internal notes visually distinct", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail());
    vi.spyOn(api, "getComments").mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByText("Public Comments")).toBeInTheDocument();
    const internalHeading = await screen.findByText(/internal notes — staff only/i);
    expect(internalHeading).toBeInTheDocument();
    // The internal thread carries an explicit never-visible-to-requester guard.
    expect(await screen.findByText(/never visible to the requester/i)).toBeInTheDocument();
    // Distinct panel styling hook (amber-tinted, not the plain comment panel).
    expect(document.querySelector(".internal-notes-panel")).not.toBeNull();
  });

  it("surfaces the problem-appears-resolved flag without changing status", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(
      detail({ problemAppearsResolvedAt: "2026-09-03T10:00:00.000Z" }),
    );
    renderDetail();

    expect(await screen.findByText(/requester flagged this problem as appearing resolved/i)).toBeInTheDocument();
    // The ticket status itself is untouched by the flag.
    expect(screen.getByText("OPEN (current)")).toBeInTheDocument();
  });

  it("shows a retryable failure when the detail API rejects", async () => {
    vi
      .spyOn(api, "getStaffTicket")
      .mockRejectedValueOnce(new api.ApiError(404, "NOT_FOUND", "Ticket not found."))
      .mockResolvedValue(detail());
    renderDetail();

    expect(await screen.findByText("Ticket not found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("TKT-2026-000101")).toBeInTheDocument();
  });
});
