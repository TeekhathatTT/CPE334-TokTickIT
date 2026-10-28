import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionsTaken } from "../../src/components/tickets/ActionsTaken";
import * as api from "../../src/api";

afterEach(() => {
  vi.restoreAllMocks();
});

function action(overrides: Partial<api.ActionTaken> = {}): api.ActionTaken {
  return {
    id: 1,
    ticketId: 101,
    actionDate: "2026-09-02T09:00:00.000Z",
    description: "Replaced the battery under warranty",
    result: "RESOLVED_STEP",
    followUpRequired: false,
    followUpNote: null,
    followUpResolvedAt: null,
    resolvedBy: null,
    attachmentNotes: null,
    performedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" },
    createdAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    ...overrides,
  };
}

function renderStaff(overrides: Partial<Parameters<typeof ActionsTaken>[0]> = {}) {
  return render(<ActionsTaken ticketId={101} mode="staff" currentUserId={21} {...overrides} />);
}

describe("Lab 4 ActionsTaken (staff)", () => {
  it("renders the thread with result and follow-up badges", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([
      action(),
      action({ id: 2, description: "Escalated to the vendor", result: "ESCALATED", followUpRequired: true, followUpNote: "Check the fan in three days" }),
    ]);

    renderStaff();

    expect(await screen.findByText("Replaced the battery under warranty")).toBeInTheDocument();
    const thread = document.querySelector(".comment-list") as HTMLElement;
    expect(within(thread).getByText("Resolved step")).toBeInTheDocument();
    expect(within(thread).getByText("Follow-up required")).toBeInTheDocument();
    expect(within(thread).getByText(/follow-up: check the fan in three days/i)).toBeInTheDocument();
  });

  it("reveals the follow-up note only when follow-up is required", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderStaff();
    await screen.findByText(/no actions recorded yet/i);

    const checkbox = screen.getByLabelText(/follow-up required/i);
    expect(screen.queryByLabelText(/follow-up note/i)).toBeNull();

    fireEvent.click(checkbox);
    expect(screen.getByLabelText(/follow-up note/i)).toBeInTheDocument();

    fireEvent.click(checkbox);
    expect(screen.queryByLabelText(/follow-up note/i)).toBeNull();
  });

  it("blocks an incomplete entry and records a valid one", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    const create = vi.spyOn(api, "createStaffAction").mockResolvedValue(action({ id: 7, description: "Reset the SSO password" }));

    renderStaff();
    await screen.findByText(/no actions recorded yet/i);

    const createButton = screen.getByRole("button", { name: /record action/i });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Reset the SSO password" } });
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(101, {
        description: "Reset the SSO password",
        result: "RESOLVED_STEP",
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
      }),
    );
    expect(await screen.findByText("Reset the SSO password")).toBeInTheDocument();
  });

  it("keeps the entry blocked until a required follow-up note is supplied", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderStaff();
    await screen.findByText(/no actions recorded yet/i);

    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Swap the docking station" } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));

    const createButton = screen.getByRole("button", { name: /record action/i });
    expect(createButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/follow-up note/i), { target: { value: "Confirm the new dock works" } });
    expect(createButton).toBeEnabled();
  });

  it("shows Edit only to the author but lets any staff resolve a pending row", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([
      action({ id: 1, performedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" }, followUpRequired: true }),
      action({ id: 2, description: "Escalated to the vendor", performedBy: { id: 99, name: "Tom Nguyen", role: "IT_STAFF" } }),
    ]);

    renderStaff();

    await screen.findByText("Replaced the battery under warranty");
    expect(screen.getAllByRole("button", { name: /^edit$/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /mark follow-up resolved/i })).toBeInTheDocument();
  });

  it("resolves a follow-up with the last-seen updatedAt and notifies the page", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([action({ id: 4, followUpRequired: true, updatedAt: "2026-09-05T08:00:00.000Z" })]);
    const patch = vi
      .spyOn(api, "patchStaffAction")
      .mockResolvedValue(action({ id: 4, followUpRequired: true, followUpResolvedAt: "2026-09-06T08:00:00.000Z", resolvedBy: { id: 21, name: "Priya Patel", role: "IT_STAFF" } }));
    const onChanged = vi.fn();

    renderStaff({ onChanged });

    fireEvent.click(await screen.findByRole("button", { name: /mark follow-up resolved/i }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(101, 4, { markFollowUpResolved: true, expectedUpdatedAt: "2026-09-05T08:00:00.000Z" }),
    );
    expect(await screen.findByText("Follow-up resolved")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("saves an edit with expectedUpdatedAt", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([action({ id: 1, updatedAt: "2026-09-04T10:00:00.000Z" })]);
    const patch = vi.spyOn(api, "patchStaffAction").mockResolvedValue(action({ id: 1, description: "Replaced the battery again" }));

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(101, 1, {
        description: "Replaced the battery under warranty",
        result: "RESOLVED_STEP",
        followUpRequired: false,
        followUpNote: null,
        attachmentNotes: null,
        expectedUpdatedAt: "2026-09-04T10:00:00.000Z",
      }),
    );
    expect(await screen.findByText("Replaced the battery again")).toBeInTheDocument();
  });

  it("offers Reload/Keep on edit conflict and preserves the draft", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([action({ id: 1 })]);
    vi.spyOn(api, "patchStaffAction").mockRejectedValue(new api.ApiError(409, "VERSION_CONFLICT", "Stale."));

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Replaced the battery under warranty"), {
      target: { value: "Replaced the battery (my wording)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/someone else changed this entry/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload entry/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /keep my text/i }));
    // The user's in-progress wording is never discarded.
    expect(await screen.findByText(/your wording was kept/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Replaced the battery (my wording)")).toBeInTheDocument();
  });

  it("shows the current entry on Reload entry without discarding the draft", async () => {
    const stale = action({ id: 1, updatedAt: "2026-09-04T10:00:00.000Z" });
    const fresh = action({
      id: 1,
      description: "Replaced the battery (server wording)",
      updatedAt: "2026-09-05T11:00:00.000Z",
    });
    vi.spyOn(api, "getStaffActions")
      .mockResolvedValueOnce([stale])
      .mockResolvedValue([fresh]);
    vi.spyOn(api, "patchStaffAction").mockRejectedValue(
      new api.ApiError(409, "VERSION_CONFLICT", "Stale.", undefined, { currentUpdatedAt: "2026-09-05T11:00:00.000Z" }),
    );

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Replaced the battery under warranty"), {
      target: { value: "Replaced the battery (my wording)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/someone else changed this entry/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reload entry/i }));

    // The current entry is shown for comparison; the draft is untouched.
    expect(await screen.findByText(/current entry \(from the server\)/i)).toBeInTheDocument();
    expect(screen.getByText("Replaced the battery (server wording)")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Replaced the battery (my wording)")).toBeInTheDocument();
  });

  it("re-targets the current version after Keep my text so the retry succeeds", async () => {
    const stale = action({ id: 1, updatedAt: "2026-09-04T10:00:00.000Z" });
    const fresh = action({
      id: 1,
      description: "Replaced the battery (server wording)",
      updatedAt: "2026-09-05T11:00:00.000Z",
    });
    vi.spyOn(api, "getStaffActions")
      .mockResolvedValueOnce([stale])
      .mockResolvedValue([fresh]);
    const patch = vi
      .spyOn(api, "patchStaffAction")
      .mockRejectedValueOnce(
        new api.ApiError(409, "VERSION_CONFLICT", "Stale.", undefined, { currentUpdatedAt: "2026-09-05T11:00:00.000Z" }),
      )
      .mockResolvedValueOnce(fresh);

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Replaced the battery under warranty"), {
      target: { value: "Replaced the battery (my wording)" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/someone else changed this entry/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /keep my text/i }));
    expect(await screen.findByText(/your wording was kept/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Replaced the battery (my wording)")).toBeInTheDocument();

    // The retry is sent against the current version, so it can succeed.
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(patch).toHaveBeenLastCalledWith(
        101,
        1,
        expect.objectContaining({ expectedUpdatedAt: "2026-09-05T11:00:00.000Z" }),
      ),
    );
    expect(await screen.findByText("Replaced the battery (server wording)")).toBeInTheDocument();
  });

  it("does not load the preserved follow-up note into the draft when follow-up is off", async () => {
    const row = action({
      id: 3,
      followUpRequired: false,
      followUpNote: "Old note kept as history",
      updatedAt: "2026-09-04T10:00:00.000Z",
    });
    vi.spyOn(api, "getStaffActions").mockResolvedValue([row]);
    const patch = vi.spyOn(api, "patchStaffAction").mockResolvedValue(row);

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));

    const editForm = document.querySelector(".action-edit") as HTMLElement;
    // The history note is not a pending note: the draft stays empty and the
    // form stays saveable.
    expect(within(editForm).queryByLabelText(/follow-up note/i)).toBeNull();
    expect(within(editForm).getByRole("button", { name: /save changes/i })).toBeEnabled();

    fireEvent.click(within(editForm).getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        101,
        3,
        expect.objectContaining({ followUpRequired: false, followUpNote: null }),
      ),
    );
  });

  it("lets the author correct the attachment reference from the edit form", async () => {
    const row = action({ id: 4, attachmentNotes: "wrong-file.png" });
    vi.spyOn(api, "getStaffActions").mockResolvedValue([row]);
    const patch = vi
      .spyOn(api, "patchStaffAction")
      .mockResolvedValue({ ...row, attachmentNotes: "right-file.png" });

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /^edit$/i }));

    const editForm = document.querySelector(".action-edit") as HTMLElement;
    const attachment = within(editForm).getByLabelText(/attachment reference/i) as HTMLInputElement;
    expect(attachment).toHaveValue("wrong-file.png");

    fireEvent.change(attachment, { target: { value: "right-file.png" } });
    fireEvent.click(within(editForm).getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        101,
        4,
        expect.objectContaining({ attachmentNotes: "right-file.png" }),
      ),
    );
  });

  it("explains why Record action is disabled", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderStaff();
    await screen.findByText(/no actions recorded yet/i);

    const createButton = screen.getByRole("button", { name: /record action/i });
    expect(createButton).toBeDisabled();
    const hint = document.getElementById("action-submit-hint-101");
    expect(hint).toHaveTextContent(/description must be between 5 and 2000 characters/i);
  });

  it("shows the required-when rule inline while the follow-up note is missing", async () => {
    vi.spyOn(api, "getStaffActions").mockResolvedValue([]);
    renderStaff();
    await screen.findByText(/no actions recorded yet/i);

    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: "Swap the docking station" } });
    fireEvent.click(screen.getByLabelText(/follow-up required/i));

    const noteError = document.getElementById("action-note-error-101");
    expect(noteError).toHaveTextContent(/follow-up note is required/i);
    expect(document.getElementById("action-submit-hint-101")).toHaveTextContent(/follow-up note is required/i);
    expect(screen.getByRole("button", { name: /record action/i })).toBeDisabled();
  });

  it("re-reads the list when someone else resolved the follow-up first", async () => {
    const pending = action({ id: 5, followUpRequired: true, updatedAt: "2026-09-04T10:00:00.000Z" });
    const resolved = action({
      id: 5,
      followUpRequired: true,
      followUpResolvedAt: "2026-09-05T10:00:00.000Z",
      updatedAt: "2026-09-05T10:00:00.000Z",
    });
    vi.spyOn(api, "getStaffActions")
      .mockResolvedValueOnce([pending])
      .mockResolvedValue([resolved]);
    vi.spyOn(api, "patchStaffAction").mockRejectedValue(
      new api.ApiError(409, "FOLLOW_UP_ALREADY_RESOLVED", "This follow-up has already been resolved."),
    );

    renderStaff();
    fireEvent.click(await screen.findByRole("button", { name: /mark follow-up resolved/i }));

    expect(await screen.findByText(/already been resolved/i)).toBeInTheDocument();
    // The stale control disappears because the list was re-read.
    await waitFor(() => expect(screen.queryByRole("button", { name: /mark follow-up resolved/i })).toBeNull());
  });
});

describe("Lab 4 ActionsTaken (requester)", () => {
  it("is read-only: full shape, no create/edit/resolve controls", async () => {
    vi.spyOn(api, "getRequesterActions").mockResolvedValue([
      action({ followUpRequired: true, followUpNote: "Waiting on the vendor" }),
    ]);

    render(<ActionsTaken ticketId={101} mode="requester" />);

    expect(await screen.findByText("Replaced the battery under warranty")).toBeInTheDocument();
    expect(screen.getByText("Follow-up required")).toBeInTheDocument();
    expect(screen.getByText(/recorded by it — read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record action/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /mark follow-up resolved/i })).toBeNull();
  });
});
