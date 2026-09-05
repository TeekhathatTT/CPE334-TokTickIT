import { useEffect, useRef, useState } from "react";
import { addAttachment, downloadAttachment, getTicket, removeAttachment } from "../api";

interface AttachmentItem {
  id: number;
  originalFilename: string;
  sizeBytes: number;
  uploadedAt?: string;
  removedAt?: string | null;
  removalReason?: string | null;
}

interface TicketDetailData {
  id: number;
  ticketNumber: string;
  createdAt: string;
  category: string;
  relatedSystem: string;
  requester: string;
  requestedPriority: string;
  itPriority?: string | null;
  status: string;
  ticketOwner?: string | null;
  summary: string;
  description: string;
  attachments?: {
    active?: AttachmentItem[];
    removed?: AttachmentItem[];
  };
}

export default function TicketDetailPage({ ticketId, requesterId, onBack }: { ticketId: number; requesterId: number; onBack?: () => void }) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AttachmentItem | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTicket() {
      try {
        const payload = await getTicket(ticketId, requesterId);
        if (!active) return;
        setTicket(payload as unknown as TicketDetailData);
      } catch (detailError) {
        if (active) {
          setActionError(detailError instanceof Error ? detailError.message : "Unable to load ticket.");
          setTicket(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTicket();
    return () => { active = false; };
  }, [ticketId, requesterId]);

  if (loading) return <div className="page-card">Loading ticket detail…</div>;
  if (!ticket) return <div className="page-card">Ticket not found.</div>;

  const activeAttachments = ticket.attachments?.active ?? [];
  const removedAttachments = ticket.attachments?.removed ?? [];
  const refreshTicket = async () => setTicket(await getTicket(ticketId, requesterId) as unknown as TicketDetailData);
  const handleDownload = async (attachment: AttachmentItem) => {
    try { const blob = await downloadAttachment(attachment.id, requesterId); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = attachment.originalFilename; link.click(); URL.revokeObjectURL(url); } catch (downloadError) { setActionError(downloadError instanceof Error ? downloadError.message : "Download failed."); }
  };
  const handleAdd = async (file: File) => { setActionBusy(true); setActionError(null); try { await addAttachment(ticketId, requesterId, file); await refreshTicket(); } catch (addError) { setActionError(addError instanceof Error ? addError.message : "Unable to add attachment."); } finally { setActionBusy(false); } };
  const handleRemove = async () => { if (!removeTarget || reason.trim().length < 5 || reason.trim().length > 200) return; setActionBusy(true); setActionError(null); try { await removeAttachment(removeTarget.id, requesterId, reason.trim()); setRemoveTarget(null); setReason(""); await refreshTicket(); } catch (removeError) { setActionError(removeError instanceof Error ? removeError.message : "Unable to remove attachment."); } finally { setActionBusy(false); } };

  return (
    <div className="page-card">
      <div className="breadcrumb" aria-label="Breadcrumb"><span>My Tickets</span><span aria-hidden="true"> &gt; </span><strong>Ticket Details</strong></div>
      <div className="ticket-detail-header">
        <button type="button" className="secondary-button" onClick={onBack}>← Back to My Tickets</button>
      </div>

      <div className="detail-grid">
        <div><strong>Ticket No.</strong><div>{ticket.ticketNumber}</div></div>
        <div><strong>Ticket Date</strong><div>{new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
        <div><strong>Category</strong><div>{ticket.category}</div></div>
        <div><strong>Related System</strong><div>{ticket.relatedSystem}</div></div>
        <div><strong>Requester</strong><div>{ticket.requester}</div></div>
        <div><strong>Requested Priority</strong><div>{ticket.requestedPriority}</div></div>
        <div><strong>IT Priority</strong><div>{ticket.itPriority ?? "None"}</div></div>
        <div><strong>Current Status</strong><div>{ticket.status}</div></div>
        <div><strong>Ticket Owner</strong><div>{ticket.ticketOwner ?? "-"}</div></div>
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
        <h3>Attachments</h3>
        <div className="attachment-panel">
          {actionError && <div className="error-panel" role="alert">{actionError}</div>}
          <input ref={fileInputRef} type="file" hidden accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleAdd(file); event.target.value = ""; }} />
          <button type="button" className="primary-button" disabled={activeAttachments.length >= 5 || actionBusy} title={activeAttachments.length >= 5 ? "Maximum 5 active attachments reached" : "Add attachment"} onClick={() => fileInputRef.current?.click()}>Add Attachment</button>
          <h4>Active</h4>
          {activeAttachments.length === 0 ? <div>No active attachments.</div> : activeAttachments.map((attachment) => (
            <div key={attachment.id} className="attachment-card">
                <div className="attachment-card__name" title={attachment.originalFilename}>{attachment.originalFilename}</div>
              <div>{Math.round(attachment.sizeBytes / 1024)} KB</div>
              <div>{attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</div>
                <button type="button" className="secondary-button" onClick={() => void handleDownload(attachment)}>Download</button>
                <button type="button" className="destructive-button" onClick={() => setRemoveTarget(attachment)}>Remove</button>
            </div>
          ))}

          {removedAttachments.length > 0 && (
            <div className="attachment-removed">
              <button type="button" className="tertiary-button" onClick={() => setShowRemoved((current) => !current)}>Show removed ({removedAttachments.length})</button>
              {showRemoved && <div><h4>Removed</h4>
              {removedAttachments.map((attachment) => (
                <div key={attachment.id} className="attachment-card attachment-card--removed">
                  <div className="attachment-card__name" title={attachment.originalFilename}>{attachment.originalFilename}</div>
                  <div>{Math.round(attachment.sizeBytes / 1024)} KB</div>
                  <div>{attachment.removalReason ?? "No reason provided"}</div>
                  <span className="muted-label">Unavailable</span>
                </div>
              ))}</div>}
            </div>
          )}
        </div>
      </div>
      {removeTarget && <div className="modal-backdrop" role="presentation"><div className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-title"><h2 id="remove-title">Remove attachment?</h2><p>{removeTarget.originalFilename}</p><label className="field-label" htmlFor="removal-reason">Reason (5–200 characters) *</label><textarea id="removal-reason" className="textarea-field" value={reason} onChange={(event) => setReason(event.target.value)} aria-describedby="removal-reason-error" /><div id="removal-reason-error" className="field-error" role="alert">{reason.length > 0 && (reason.trim().length < 5 || reason.trim().length > 200) ? "Reason must be between 5 and 200 characters." : ""}</div><div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => { setRemoveTarget(null); setReason(""); }}>Cancel</button><button type="button" className="destructive-button" disabled={actionBusy || reason.trim().length < 5 || reason.trim().length > 200} onClick={() => void handleRemove()}>Confirm Remove</button></div></div></div>}
    </div>
  );
}
