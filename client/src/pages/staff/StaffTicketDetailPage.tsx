import { useEffect, useState } from "react";
import {
  assignStaffTicket,
  getStaffTicket,
  updateStaffPriority,
  updateStaffStatus,
  type StaffTicketDetail,
} from "../../api";
import type { Priority, TicketStatus } from "../../types/ticket";
import { PublicComments } from "../../components/tickets/PublicComments";
import { InternalNotes } from "../../components/tickets/InternalNotes";

interface StaffTicketDetailPageProps {
  ticketId: number;
  currentUserId: number;
  onBack?: () => void;
}

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

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

  const [priorityBusy, setPriorityBusy] = useState(false);
  const [priorityMessage, setPriorityMessage] = useState<string | null>(null);
  const [priorityError, setPriorityError] = useState<string | null>(null);

  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  const mutate = async (
    operation: () => Promise<StaffTicketDetail>,
    setBusy: (busy: boolean) => void,
    setOk: (message: string | null) => void,
    setFail: (message: string | null) => void,
    okCopy: string,
  ) => {
    setBusy(true);
    setOk(null);
    setFail(null);
    try {
      const updated = await operation();
      setTicket(updated);
      setOk(okCopy);
    } catch (failure) {
      setFail(failure instanceof Error ? failure.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  };

  const handleClaim = () =>
    void mutate(() => assignStaffTicket(ticketId, currentUserId), setAssignBusy, setAssignMessage, setAssignError, "Ticket claimed.");
  const handleUnassign = () =>
    void mutate(() => assignStaffTicket(ticketId, null), setAssignBusy, setAssignMessage, setAssignError, "Ticket unassigned.");
  const handleReassign = () => {
    const parsed = Number(reassignId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setAssignError("Owner ID must be a positive number.");
      return;
    }
    void mutate(() => assignStaffTicket(ticketId, parsed), setAssignBusy, setAssignMessage, setAssignError, "Ticket reassigned.");
  };

  const handlePriority = (value: string) => {
    if (!PRIORITIES.includes(value as Priority)) return;
    void mutate(
      () => updateStaffPriority(ticketId, value as Priority),
      setPriorityBusy, setPriorityMessage, setPriorityError, "IT Priority updated.",
    );
  };

  const handleStatus = (value: string) => {
    if (value === "" || !ticket || value === ticket.status) return;
    void mutate(
      () => updateStaffStatus(ticketId, value as TicketStatus),
      setStatusBusy, setStatusMessage, setStatusError, "Status updated.",
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
          <label className="field-label" htmlFor={`reassign-${ticketId}`}>Reassign to IT Staff user ID</label>
          <input
            id={`reassign-${ticketId}`}
            className="input-field"
            inputMode="numeric"
            value={reassignId}
            onChange={(event) => setReassignId(event.target.value)}
            placeholder="e.g. 21"
          />
          <button type="button" className="secondary-button" disabled={assignBusy || reassignId.trim() === ""} onClick={handleReassign}>
            Reassign
          </button>
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

      <PublicComments ticketId={ticketId} />
      <InternalNotes ticketId={ticketId} />
    </div>
  );
}
