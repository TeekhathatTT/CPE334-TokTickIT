import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { addAttachment, downloadAttachment, getTicket, removeAttachment } from "../api";
export default function TicketDetailPage({ ticketId, requesterId, onBack }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRemoved, setShowRemoved] = useState(false);
    const [removeTarget, setRemoveTarget] = useState(null);
    const [reason, setReason] = useState("");
    const [actionError, setActionError] = useState(null);
    const [actionBusy, setActionBusy] = useState(false);
    const fileInputRef = useRef(null);
    useEffect(() => {
        let active = true;
        async function loadTicket() {
            try {
                const payload = await getTicket(ticketId, requesterId);
                if (!active)
                    return;
                setTicket(payload);
            }
            catch (detailError) {
                if (active) {
                    setActionError(detailError instanceof Error ? detailError.message : "Unable to load ticket.");
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
    const refreshTicket = async () => setTicket(await getTicket(ticketId, requesterId));
    const handleDownload = async (attachment) => {
        try {
            const blob = await downloadAttachment(attachment.id, requesterId);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.originalFilename;
            link.click();
            URL.revokeObjectURL(url);
        }
        catch (downloadError) {
            setActionError(downloadError instanceof Error ? downloadError.message : "Download failed.");
        }
    };
    const handleAdd = async (file) => { setActionBusy(true); setActionError(null); try {
        await addAttachment(ticketId, requesterId, file);
        await refreshTicket();
    }
    catch (addError) {
        setActionError(addError instanceof Error ? addError.message : "Unable to add attachment.");
    }
    finally {
        setActionBusy(false);
    } };
    const handleRemove = async () => { if (!removeTarget || reason.trim().length < 5 || reason.trim().length > 200)
        return; setActionBusy(true); setActionError(null); try {
        await removeAttachment(removeTarget.id, requesterId, reason.trim());
        setRemoveTarget(null);
        setReason("");
        await refreshTicket();
    }
    catch (removeError) {
        setActionError(removeError instanceof Error ? removeError.message : "Unable to remove attachment.");
    }
    finally {
        setActionBusy(false);
    } };
    return (_jsxs("div", { className: "page-card", children: [_jsxs("div", { className: "breadcrumb", "aria-label": "Breadcrumb", children: [_jsx("span", { children: "My Tickets" }), _jsx("span", { "aria-hidden": "true", children: " > " }), _jsx("strong", { children: "Ticket Details" })] }), _jsx("div", { className: "ticket-detail-header", children: _jsx("button", { type: "button", className: "secondary-button", onClick: onBack, children: "\u2190 Back to My Tickets" }) }), _jsxs("div", { className: "detail-grid", children: [_jsxs("div", { children: [_jsx("strong", { children: "Ticket No." }), _jsx("div", { children: ticket.ticketNumber })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ticket Date" }), _jsx("div", { children: new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) })] }), _jsxs("div", { children: [_jsx("strong", { children: "Category" }), _jsx("div", { children: ticket.category })] }), _jsxs("div", { children: [_jsx("strong", { children: "Related System" }), _jsx("div", { children: ticket.relatedSystem })] }), _jsxs("div", { children: [_jsx("strong", { children: "Requester" }), _jsx("div", { children: ticket.requester })] }), _jsxs("div", { children: [_jsx("strong", { children: "Requested Priority" }), _jsx("div", { children: ticket.requestedPriority })] }), _jsxs("div", { children: [_jsx("strong", { children: "IT Priority" }), _jsx("div", { children: ticket.itPriority ?? "None" })] }), _jsxs("div", { children: [_jsx("strong", { children: "Current Status" }), _jsx("div", { children: ticket.status })] }), _jsxs("div", { children: [_jsx("strong", { children: "Ticket Owner" }), _jsx("div", { children: ticket.ticketOwner ?? "-" })] })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Summary" }), _jsx("p", { children: ticket.summary })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Description" }), _jsx("p", { children: ticket.description })] }), _jsxs("div", { className: "detail-section", children: [_jsx("h3", { children: "Attachments" }), _jsxs("div", { className: "attachment-panel", children: [actionError && _jsx("div", { className: "error-panel", role: "alert", children: actionError }), _jsx("input", { ref: fileInputRef, type: "file", hidden: true, accept: ".jpg,.jpeg,.png,.webp,.pdf", onChange: (event) => { const file = event.target.files?.[0]; if (file)
                                    void handleAdd(file); event.target.value = ""; } }), _jsx("button", { type: "button", className: "primary-button", disabled: activeAttachments.length >= 5 || actionBusy, title: activeAttachments.length >= 5 ? "Maximum 5 active attachments reached" : "Add attachment", onClick: () => fileInputRef.current?.click(), children: "Add Attachment" }), _jsx("h4", { children: "Active" }), activeAttachments.length === 0 ? _jsx("div", { children: "No active attachments." }) : activeAttachments.map((attachment) => (_jsxs("div", { className: "attachment-card", children: [_jsx("div", { className: "attachment-card__name", title: attachment.originalFilename, children: attachment.originalFilename }), _jsxs("div", { children: [Math.round(attachment.sizeBytes / 1024), " KB"] }), _jsx("div", { children: attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void handleDownload(attachment), children: "Download" }), _jsx("button", { type: "button", className: "destructive-button", onClick: () => setRemoveTarget(attachment), children: "Remove" })] }, attachment.id))), removedAttachments.length > 0 && (_jsxs("div", { className: "attachment-removed", children: [_jsxs("button", { type: "button", className: "tertiary-button", onClick: () => setShowRemoved((current) => !current), children: ["Show removed (", removedAttachments.length, ")"] }), showRemoved && _jsxs("div", { children: [_jsx("h4", { children: "Removed" }), removedAttachments.map((attachment) => (_jsxs("div", { className: "attachment-card attachment-card--removed", children: [_jsx("div", { className: "attachment-card__name", title: attachment.originalFilename, children: attachment.originalFilename }), _jsxs("div", { children: [Math.round(attachment.sizeBytes / 1024), " KB"] }), _jsx("div", { children: attachment.removalReason ?? "No reason provided" }), _jsx("span", { className: "muted-label", children: "Unavailable" })] }, attachment.id)))] })] }))] })] }), removeTarget && _jsx("div", { className: "modal-backdrop", role: "presentation", children: _jsxs("div", { className: "confirmation-dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "remove-title", children: [_jsx("h2", { id: "remove-title", children: "Remove attachment?" }), _jsx("p", { children: removeTarget.originalFilename }), _jsx("label", { className: "field-label", htmlFor: "removal-reason", children: "Reason (5\u2013200 characters) *" }), _jsx("textarea", { id: "removal-reason", className: "textarea-field", value: reason, onChange: (event) => setReason(event.target.value), "aria-describedby": "removal-reason-error" }), _jsx("div", { id: "removal-reason-error", className: "field-error", role: "alert", children: reason.length > 0 && (reason.trim().length < 5 || reason.trim().length > 200) ? "Reason must be between 5 and 200 characters." : "" }), _jsxs("div", { className: "dialog-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: () => { setRemoveTarget(null); setReason(""); }, children: "Cancel" }), _jsx("button", { type: "button", className: "destructive-button", disabled: actionBusy || reason.trim().length < 5 || reason.trim().length > 200, onClick: () => void handleRemove(), children: "Confirm Remove" })] })] }) })] }));
}
