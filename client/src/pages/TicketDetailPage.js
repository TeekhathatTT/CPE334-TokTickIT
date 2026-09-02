import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export default function TicketDetailPage({ ticketId, requesterId }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        async function loadTicket() {
            try {
                const response = await fetch(`http://localhost:3000/api/tickets/${ticketId}`, {
                    headers: { "x-requester-id": String(requesterId) },
                });
                if (!response.ok)
                    throw new Error("Failed");
                const payload = await response.json();
                if (!active)
                    return;
                setTicket(payload.data ?? null);
            }
            catch {
                if (active) {
                    setTicket(null);
                }
            }
            finally {
                if (active) {
                    setLoading(false);
                }
            }
        }
        void loadTicket();
        return () => { active = false; };
    }, [ticketId, requesterId]);
    if (loading)
        return _jsx("div", { className: "page-card", children: "Loading ticket detail\u2026" });
    if (!ticket)
        return _jsx("div", { className: "page-card", children: "Ticket not found." });
    const activeAttachments = ticket.attachments?.active ?? [];
    const removedAttachments = ticket.attachments?.removed ?? [];
    return (_jsxs("div", { className: "page-card", children: [_jsx("div", { className: "ticket-detail-header", children: _jsx("button", { type: "button", className: "secondary-button", children: "\u2190 Back to My Tickets" }) }), _jsxs("div", { className: "detail-grid", children: [_jsxs("div", { children: [_jsx("strong", { children: "Ticket No." }), _jsx("div", { children: ticket.ticketNumber })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ticket Date" }), _jsx("div", { children: new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) })] }), _jsxs("div", { children: [_jsx("strong", { children: "Category" }), _jsx("div", { children: ticket.category })] }), _jsxs("div", { children: [_jsx("strong", { children: "Related System" }), _jsx("div", { children: ticket.relatedSystem })] }), _jsxs("div", { children: [_jsx("strong", { children: "Requester" }), _jsx("div", { children: ticket.requester })] }), _jsxs("div", { children: [_jsx("strong", { children: "Requested" }), _jsx("div", { children: ticket.requestedPriority })] }), _jsxs("div", { children: [_jsx("strong", { children: "IT Priority" }), _jsx("div", { children: ticket.itPriority ?? "-" })] }), _jsxs("div", { children: [_jsx("strong", { children: "Status" }), _jsx("div", { children: ticket.status })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ticket Owner" }), _jsx("div", { children: ticket.ticketOwner ?? "-" })] })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Summary" }), _jsx("p", { children: ticket.summary })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Description" }), _jsx("p", { children: ticket.description })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Attachments" }), _jsxs("div", { className: "attachment-panel", children: [_jsx("h4", { children: "Active" }), activeAttachments.length === 0 ? _jsx("div", { children: "No active attachments." }) : activeAttachments.map((attachment) => (_jsxs("div", { className: "attachment-card", children: [_jsx("div", { children: attachment.originalFilename }), _jsxs("div", { children: [Math.round(attachment.sizeBytes / 1024), " KB"] }), _jsx("div", { children: attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-" })] }, attachment.id))), removedAttachments.length > 0 && (_jsxs("div", { className: "attachment-removed", children: [_jsx("h4", { children: "Removed" }), removedAttachments.map((attachment) => (_jsxs("div", { className: "attachment-card attachment-card--removed", children: [_jsx("div", { children: attachment.originalFilename }), _jsxs("div", { children: [Math.round(attachment.sizeBytes / 1024), " KB"] }), _jsx("div", { children: attachment.removalReason ?? "No reason provided" })] }, attachment.id)))] }))] })] })] }));
}
