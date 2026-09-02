import { useEffect, useState } from "react";

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

export default function TicketDetailPage({ ticketId, requesterId }: { ticketId: number; requesterId: number }) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadTicket() {
      try {
        const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
          headers: { "x-requester-id": String(requesterId) },
        });
        if (!response.ok) throw new Error("Failed");
        const payload = await response.json();
        if (!active) return;
        setTicket(payload.data ?? null);
      } catch {
        if (active) {
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

  return (
    <div className="page-card">
      <div className="ticket-detail-header">
        <button type="button" className="secondary-button">← Back to My Tickets</button>
      </div>

      <div className="detail-grid">
        <div><strong>Ticket No.</strong><div>{ticket.ticketNumber}</div></div>
        <div><strong>Ticket Date</strong><div>{new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div></div>
        <div><strong>Category</strong><div>{ticket.category}</div></div>
        <div><strong>Related System</strong><div>{ticket.relatedSystem}</div></div>
        <div><strong>Requester</strong><div>{ticket.requester}</div></div>
        <div><strong>Requested</strong><div>{ticket.requestedPriority}</div></div>
        <div><strong>IT Priority</strong><div>{ticket.itPriority ?? "-"}</div></div>
        <div><strong>Status</strong><div>{ticket.status}</div></div>
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
          <h4>Active</h4>
          {activeAttachments.length === 0 ? <div>No active attachments.</div> : activeAttachments.map((attachment) => (
            <div key={attachment.id} className="attachment-card">
              <div>{attachment.originalFilename}</div>
              <div>{Math.round(attachment.sizeBytes / 1024)} KB</div>
              <div>{attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</div>
            </div>
          ))}

          {removedAttachments.length > 0 && (
            <div className="attachment-removed">
              <h4>Removed</h4>
              {removedAttachments.map((attachment) => (
                <div key={attachment.id} className="attachment-card attachment-card--removed">
                  <div>{attachment.originalFilename}</div>
                  <div>{Math.round(attachment.sizeBytes / 1024)} KB</div>
                  <div>{attachment.removalReason ?? "No reason provided"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
