import { useEffect, useState } from "react";
import {
  ApiError,
  assignStaffTicket,
  getStaffTicket,
  getStaffUsers,
  updateStaffPriority,
  updateStaffStatus,
  type StaffTicketDetail,
  type StaffUser,
} from "../../api";
import type { Priority, TicketStatus } from "../../types/ticket";
import { PublicComments } from "../../components/tickets/PublicComments";
import { InternalNotes } from "../../components/tickets/InternalNotes";
import { ActionsTaken } from "../../components/tickets/ActionsTaken";

interface StaffTicketDetailPageProps {
  ticketId: number;
  currentUserId: number;
  onBack?: () => void;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

// BR-07: the resolution gate only guards these three edges.
const RESOLUTION_GATE_EDGES = new Set<TicketStatus>(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER"]);

type MutateOperation = (expectedUpdatedAt: string) => Promise<StaffTicketDetail>;

function fieldError(message: string | null) {
  return message ? (
    <div className="error-panel" role="alert">
      {message}
    </div>
  ) : null;
}

/**
 * Staff Ticket Detail (ui-spec.md §6, FR-08/FR-09): read-only ticket context
 * plus staff-only operations — owner assignment, IT Priority, permitted
 * status transitions — with the shared PublicComments thread, the visually
 * distinct InternalNotes thread, and the BR-05 resolved-signal indicator
 * (a surfaced flag that never drives a status change itself).
 */
export function StaffTicketDetailPage({ ticketId, currentUserId, onBack }: StaffTicketDetailPageProps) {
  const [ticket, setTicket] = useState<StaffTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [reassignId, setReassignId] = useState("");

  // Assignable-owner directory (ui-spec §6 select). Loaded independently of
  // the ticket so a directory failure never blocks the rest of the screen.
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffRetryToken, setStaffRetryToken] = useState(0);

  const [priorityBusy, setPriorityBusy] = useState(false);
  const [priorityMessage, setPriorityMessage] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // BR-09 stale-write recovery shared by status/assignment/priority.
  const [conflict, setConflict] = useState(false);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [pendingOp, setPendingOp] = useState<MutateOperation | null>(null);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [conflictBusy, setConflictBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoading(true);
      setLoadError(null);
      try {
        const detail = await getStaffTicket(ticketId);
        if (!active) return;
        setTicket(detail);
      } catch (detailError) {
        if (active) {
          setLoadError(detailError instanceof Error ? detailError.message : "Unable to load ticket.");
          setTicket(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDetail();
    return () => { active = false; };
  }, [ticketId, retryToken]);

  useEffect(() => {
    let active = true;

    async function loadStaffUsers() {
      setStaffLoading(true);
      setStaffError(null);
      try {
        const users = await getStaffUsers();
        if (!active) return;
        setStaffUsers(users);
      } catch (usersError) {
        if (active) {
          setStaffError(usersError instanceof Error ? usersError.message : "Unable to load staff list.");
          setStaffUsers([]);
        }
      } finally {
        if (active) setStaffLoading(false);
      }
    }

    void loadStaffUsers();
    return () => { active = false; };
  }, [staffRetryToken]);

  // Keep the on-screen ticket in sync after an Actions Taken write (resolving a
  // follow-up clears the gate / changes pendingFollowUpCount) without toggling
  // the page's full-screen loading state.
  const refreshTicket = async () => {
    try {
      const fresh = await getStaffTicket(ticketId);
      setTicket(fresh);
    } catch {
      // The Actions Taken thread owns its own data; a quiet refresh failure must
      // never blank the ticket already on screen.
    }
  };

  const attempt = async (
    operation: MutateOperation,
    expectedUpdatedAt: string,
    setBusy: (busy: boolean) => void,
    setOk: (message: string | null) => void,
    setFail: (message: string | null) => void,
    okCopy: string,
    label: string,
    onSuccess?: () => void,
  ) => {
    setBusy(true);
    setOk(null);
    setFail(null);
    setConflict(false);
    setConflictNotice(null);
    setConflictError(null);
    try {
      const updated = await operation(expectedUpdatedAt);
      setTicket(updated);
      setOk(okCopy);
      setPendingOp(null);
      setPendingLabel(null);
      onSuccess?.();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "VERSION_CONFLICT") {
        setPendingOp(() => operation);
        setPendingLabel(label);
        setConflict(true);
      } else {
        setFail(failure instanceof Error ? failure.message : "Unable to save changes.");
      }
    } finally {
      setBusy(false);
    }
  };

  const mutate = (
    operation: MutateOperation,
    setBusy: (busy: boolean) => void,
    setOk: (message: string | null) => void,
    setFail: (message: string | null) => void,
    okCopy: string,
    label: string,
    onSuccess?: () => void,
  ) => {
    if (!ticket) return;
    void attempt(operation, ticket.updatedAt, setBusy, setOk, setFail, okCopy, label, onSuccess);
  };

  /**
   * "Reload ticket": refresh the ticket and show the current state. The
   * intended change is kept but never silently replayed — it is offered again
   * as an explicit "Retry my change" action, so the user sees what changed
   * before overwriting it (BR-09).
   */
  const handleReloadConflict = async () => {
    setConflictBusy(true);
    try {
      const fresh = await getStaffTicket(ticketId);
      setTicket(fresh);
      setConflict(false);
      setConflictError(null);
      setConflictNotice(
        pendingLabel
          ? `Ticket reloaded. Your change (${pendingLabel}) was not applied — review the current values, then retry.`
          : "Ticket reloaded.",
      );
    } catch (failure) {
      setConflictNotice(null);
      setConflictError(failure instanceof Error ? failure.message : "Unable to reload the ticket.");
    } finally {
      setConflictBusy(false);
    }
  };

  /** "Retry my change": replay the intended write against the current version. */
  const handleRetryConflict = async () => {
    const operation = pendingOp;
    if (!operation || !ticket) return;
    setConflictBusy(true);
    setConflictNotice(null);
    setConflictError(null);
    try {
      const updated = await operation(ticket.updatedAt);
      setTicket(updated);
      setPendingOp(null);
      setPendingLabel(null);
      setConflictNotice("Your change was applied to the current version.");
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "VERSION_CONFLICT") {
        setConflict(true);
      } else {
        setConflictError(failure instanceof Error ? failure.message : "Unable to apply your change.");
      }
    } finally {
      setConflictBusy(false);
    }
  };

  const handleClaim = () =>
    mutate(
      (expected) => assignStaffTicket(ticketId, currentUserId, expected),
      setAssignBusy, setAssignMessage, setAssignError,
      "Ticket claimed.",
      "Claim (assign to me)",
    );
  const handleUnassign = () =>
    mutate(
      (expected) => assignStaffTicket(ticketId, null, expected),
      setAssignBusy, setAssignMessage, setAssignError,
      "Ticket unassigned.",
      "Unassign",
    );
  const handleReassign = () => {
    const parsed = Number(reassignId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setAssignError("Select an IT Staff member to reassign to.");
      return;
    }
    void mutate(
      (expected) => assignStaffTicket(ticketId, parsed, expected),
      setAssignBusy, setAssignMessage, setAssignError,
      "Ticket reassigned.",
      `Reassign to ${staffUsers.find((member) => member.id === parsed)?.name ?? "another IT Staff member"}`,
      () => setReassignId(String(parsed)),
    );
  };

  const handlePriority = (value: string) => {
    if (!PRIORITIES.includes(value as Priority)) return;
    mutate(
      (expected) => updateStaffPriority(ticketId, value as Priority, expected),
      setPriorityBusy, setPriorityMessage, setPriorityError,
      "IT Priority updated.",
      `IT Priority → ${value}`,
    );
  };

  const handleStatus = (value: string) => {
    if (value === "" || !ticket || value === ticket.status) return;
    mutate(
      (expected) => updateStaffStatus(ticketId, value as TicketStatus, expected),
      setStatusBusy, setStatusMessage, setStatusError,
      "Status updated.",
      `Status → ${value.replaceAll("_", " ")}`,
    );
  };

  if (loading) {
    return <div className="page-card"><div className="loading-state" role="status">Loading ticket detail…</div></div>;
  }

  if (!ticket) {
    return (
      <div className="page-card">
        <div className="error-panel" role="alert">{loadError ?? "Ticket not found."}</div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => { setLoading(true); setLoadError(null); setRetryToken((token) => token + 1); }}
        >
          Retry
        </button>
      </div>
    );
  }

  const allowedStatuses = ticket.permittedActions.allowedStatuses;
  const gateBlocksResolution =
    RESOLUTION_GATE_EDGES.has(ticket.status) && ticket.pendingFollowUpCount > 0;

  return (
    <div className="page-card">
      <div className="breadcrumb" aria-label="Breadcrumb">
        <span>Ticket Queue</span>
        <span aria-hidden="true"> &gt; </span>
        <strong>Ticket Details</strong>
      </div>
      <div className="ticket-detail-header">
        <button type="button" className="secondary-button" onClick={onBack}>← Back to Ticket Queue</button>
      </div>

      {ticket.problemAppearsResolvedAt ? (
        <div className="warning-panel" role="status">
          <strong>⚠ Requester flagged this problem as appearing resolved</strong>
          <p>
            Signalled on{" "}
            {new Date(ticket.problemAppearsResolvedAt).toLocaleString("en-GB", {
              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            . Review and drive the formal status yourself — this flag never changes status on its own.
          </p>
        </div>
      ) : null}

      {conflict ? (
        <div className="warning-panel" role="alert">
          <strong>Someone else changed this ticket.</strong>
          <p>Your change was not saved. Reload to see the current version before retrying it.</p>
          {conflictError ? <p>{conflictError}</p> : null}
          <div className="ticket-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={conflictBusy}
              onClick={() => void handleReloadConflict()}
            >
              {conflictBusy ? "Reloading…" : "Reload ticket"}
            </button>
          </div>
        </div>
      ) : null}
      {conflictNotice ? (
        <div className="success-panel success-panel--inline" role="status">
          {conflictNotice}
        </div>
      ) : null}
      {pendingOp && !conflict ? (
        <div className="ticket-actions">
          <button
            type="button"
            className="primary-button"
            disabled={conflictBusy}
            onClick={() => void handleRetryConflict()}
          >
            {conflictBusy ? "Applying…" : `Retry my change${pendingLabel ? ` (${pendingLabel})` : ""}`}
          </button>
        </div>
      ) : null}

      <div className="detail-grid">
        <div><strong>Ticket No.</strong><div>{ticket.ticketNumber}</div></div>
        <div><strong>Ticket Date</strong><div>{new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
        <div><strong>Category</strong><div>{ticket.category}</div></div>
        <div><strong>Related System</strong><div>{ticket.relatedSystem}</div></div>
        <div><strong>Requester</strong><div>{ticket.requester.name} ({ticket.requester.email})</div></div>
        <div><strong>Requested Priority</strong><div>{ticket.requestedPriority}</div></div>
        <div><strong>Current Status</strong><div>{ticket.status.replaceAll("_", " ")}</div></div>
        <div><strong>Last Updated</strong><div>{new Date(ticket.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
      </div>

      <div className="detail-section">
        <h3>Summary</h3>
        <p>{ticket.summary}</p>
      </div>

      <div className="detail-section">
        <h3>Description</h3>
        <p>{ticket.description}</p>
      </div>

      <div className="detail-section">
        <h3>Ticket Owner</h3>
        <p className="helper-text">Current owner: {ticket.owner ? `${ticket.owner.name} (ID ${ticket.owner.id})` : "Unassigned"}</p>
        {fieldError(assignError)}
        {assignMessage ? <div className="success-panel success-panel--inline" role="status">{assignMessage}</div> : null}
        <div className="ticket-actions">
          <button type="button" className="primary-button" disabled={assignBusy} onClick={handleClaim}>
            {assignBusy ? "Saving…" : "Claim (assign to me)"}
          </button>
          <button type="button" className="secondary-button" disabled={assignBusy} onClick={handleUnassign}>
            Unassign
          </button>
        </div>
        <div className="ticket-actions">
          <label className="field-label" htmlFor={`reassign-${ticketId}`}>Reassign to</label>
          {staffLoading ? (
            <div className="loading-state" role="status">Loading staff list…</div>
          ) : staffError ? (
            <div className="error-panel" role="alert">
              {staffError}
              <button type="button" className="secondary-button" onClick={() => setStaffRetryToken((token) => token + 1)}>
                Retry
              </button>
            </div>
          ) : (
            <>
              <select
                id={`reassign-${ticketId}`}
                className="select-field"
                value={reassignId}
                disabled={assignBusy}
                onChange={(event) => setReassignId(event.target.value)}
              >
                <option value="">Select an IT Staff member</option>
                {staffUsers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email}){ticket.owner?.id === member.id ? " — current" : ""}
                  </option>
                ))}
              </select>
              <button type="button" className="secondary-button" disabled={assignBusy || reassignId === ""} onClick={handleReassign}>
                Reassign
              </button>
            </>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h3>IT Priority</h3>
        <p className="helper-text">Requested Priority ({ticket.requestedPriority}) is read-only and never modified here.</p>
        {fieldError(priorityError)}
        {priorityMessage ? <div className="success-panel success-panel--inline" role="status">{priorityMessage}</div> : null}
        <label className="field-label" htmlFor={`it-priority-${ticketId}`}>IT Priority</label>
        <select
          id={`it-priority-${ticketId}`}
          className="select-field"
          value={ticket.itPriority ?? ""}
          disabled={priorityBusy}
          onChange={(event) => handlePriority(event.target.value)}
        >
          <option value="" disabled>Select priority</option>
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </div>

      <div className="detail-section">
        <h3>Status</h3>
        <p className="helper-text">
          Only the transitions permitted from {ticket.status.replaceAll("_", " ")} are offered.
          Anything else is rejected server-side.
        </p>
        {gateBlocksResolution ? (
          <div className="warning-panel" role="status">
            <strong>Resolution is blocked</strong>
            <p>
              {ticket.pendingFollowUpCount} follow-up {ticket.pendingFollowUpCount === 1 ? "action is" : "actions are"} still
              pending. Resolve every follow-up in Actions Taken before moving this ticket to Resolved — the
              server rejects it with RESOLUTION_BLOCKED until then.
            </p>
          </div>
        ) : null}
        {fieldError(statusError)}
        {statusMessage ? <div className="success-panel success-panel--inline" role="status">{statusMessage}</div> : null}
        <label className="field-label" htmlFor={`status-${ticketId}`}>Change status</label>
        <select
          id={`status-${ticketId}`}
          className="select-field"
          value={ticket.status}
          disabled={statusBusy || allowedStatuses.length === 0}
          onChange={(event) => handleStatus(event.target.value)}
        >
          <option value={ticket.status}>{ticket.status.replaceAll("_", " ")} (current)</option>
          {allowedStatuses
            .filter((value) => value !== ticket.status)
            .map((value) => (
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
            ))}
        </select>
      </div>

      <div className="detail-section">
        <h3>Attachments</h3>
        <div className="attachment-panel">
          {ticket.attachments.length === 0 ? (
            <div>No attachments.</div>
          ) : (
            ticket.attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-card">
                <div className="attachment-card__name" title={attachment.originalFilename}>{attachment.originalFilename}</div>
                <div>{Math.round(attachment.sizeBytes / 1024)} KB</div>
                <div>{attachment.removedAt ? `Removed — ${attachment.removalReason ?? "no reason"}` : "Active"}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Thread order is fixed (ui-spec.md §1): Public Comments, then Internal
          Notes, then Actions Taken. */}
      <PublicComments ticketId={ticketId} />
      <InternalNotes ticketId={ticketId} />
      <ActionsTaken
        ticketId={ticketId}
        mode="staff"
        currentUserId={currentUserId}
        onChanged={() => void refreshTicket()}
      />
    </div>
  );
}
