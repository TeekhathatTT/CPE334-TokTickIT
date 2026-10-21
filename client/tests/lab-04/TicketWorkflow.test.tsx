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
    pendingFollowUpCount: 0,
    ...overrides,
  };
}

function action(overrides: Partial<api.ActionTaken> = {}): api.ActionTaken {
  return {
    id: 1,
    ticketId: 101,
    actionDate: "2026-09-02T09:00:00.000Z",
    description: "Ordered a replacement battery",
    result: "WORKAROUND",
    followUpRequired: true,
    followUpNote: "Confirm delivery in three days",
    followUpResolvedAt: null,
    resolvedBy: null,
    attachmentNotes: null,
    performedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" },
    createdAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    ...overrides,
  };
}

function renderWorkflow() {
  vi.spyOn(api, "getStaffUsers").mockResolvedValue([{ id: 21, name: "Priya Patel", email: "priya.patel@example.com" }]);
  vi.spyOn(api, "getInternalNotes").mockResolvedValue([]);
  vi.spyOn(api, "getComments").mockResolvedValue([]);
  render(<StaffTicketDetailPage ticketId={101} currentUserId={21} />);
}

describe("Lab 4 TicketWorkflow (resolution gate)", () => {
  it("shows the gate banner with the authoritative pending count", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail({ pendingFollowUpCount: 2 }));
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderWorkflow();

    expect(await screen.findByText(/resolution is blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/2 follow-up actions are still pending/i)).toBeInTheDocument();
  });

  it("hides the gate banner when nothing is pending", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail({ pendingFollowUpCount: 0 }));
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderWorkflow();

    await screen.findByText("TKT-2026-000101");
    expect(screen.queryByText(/resolution is blocked/i)).toBeNull();
  });

  it("hides the gate banner outside the three gate edges", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(
      detail({ status: "REOPENED", pendingFollowUpCount: 3, permittedActions: { allowedStatuses: ["IN_PROGRESS", "RESOLVED"] } }),
    );
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderWorkflow();

    await screen.findByText("TKT-2026-000101");
    expect(screen.queryByText(/resolution is blocked/i)).toBeNull();
  });

  it("clears the banner once the follow-up is resolved (page refresh)", async () => {
    vi.spyOn(api, "getStaffTicket")
      .mockResolvedValueOnce(detail({ pendingFollowUpCount: 1 }))
      .mockResolvedValue(detail({ pendingFollowUpCount: 0 }));
    vi.spyOn(api, "getStaffActions").mockResolvedValue([action()]);
    vi.spyOn(api, "patchStaffAction").mockResolvedValue(
      action({ followUpResolvedAt: "2026-09-06T08:00:00.000Z", resolvedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" } }),
    );

    renderWorkflow();
    expect(await screen.findByText(/resolution is blocked/i)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: /mark follow-up resolved/i }));

    await waitFor(() => expect(screen.queryByText(/resolution is blocked/i)).toBeNull());
  });

  it("orders the threads Public Comments → Internal Notes → Actions Taken", async () => {
    vi.spyOn(api, "getStaffTicket").mockResolvedValue(detail());
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderWorkflow();

    await screen.findByText("TKT-2026-000101");
    const headings = Array.from(document.querySelectorAll(".detail-section h3")).map(
      (node) => node.textContent?.trim() ?? "",
    );
    const publicIndex = headings.findIndex((text) => /public comments/i.test(text));
    const notesIndex = headings.findIndex((text) => /internal notes/i.test(text));
    const actionsIndex = headings.findIndex((text) => /actions taken/i.test(text));

    expect(publicIndex).toBeGreaterThanOrEqual(0);
    expect(notesIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(publicIndex).toBeLessThan(notesIndex);
    expect(notesIndex).toBeLessThan(actionsIndex);
  });
});

describe("Lab 4 TicketWorkflow (stale write)", () => {
  it("surfaces VERSION_CONFLICT, reloads, and replays only on an explicit retry", async () => {
    vi.spyOn(api, "getStaffTicket")
      .mockResolvedValueOnce(detail({ updatedAt: "2026-09-02T09:00:00.000Z" }))
      .mockResolvedValueOnce(detail({ updatedAt: "2026-09-03T09:00:00.000Z" }));
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    const status = vi
      .spyOn(api, "updateStaffStatus")
      .mockRejectedValueOnce(new api.ApiError(409, "VERSION_CONFLICT", "Stale."))
      .mockResolvedValueOnce(detail({ status: "IN_PROGRESS", updatedAt: "2026-09-03T09:00:00.000Z" }));

    renderWorkflow();
    const select = (await screen.findByLabelText(/change status/i)) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "IN_PROGRESS" } });

    expect(await screen.findByText(/someone else changed this ticket/i)).toBeInTheDocument();
    expect(status).toHaveBeenCalledWith(101, "IN_PROGRESS", "2026-09-02T09:00:00.000Z");

    fireEvent.click(screen.getByRole("button", { name: /reload ticket/i }));

    // The reload only refreshes the ticket: the stale write is never replayed
    // silently, so the user sees what changed before overwriting it.
    expect(await screen.findByText(/ticket reloaded/i)).toBeInTheDocument();
    expect(status).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /retry my change/i }));

    await waitFor(() =>
      expect(status).toHaveBeenLastCalledWith(101, "IN_PROGRESS", "2026-09-03T09:00:00.000Z"),
    );
    expect(await screen.findByText(/your change was applied/i)).toBeInTheDocument();
  });
});
