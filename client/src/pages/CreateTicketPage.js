import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AttachmentPicker } from "../components/AttachmentPicker";
import { getCategories, getRelatedSystems, createTicket } from "../api";
const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
export default function CreateTicketPage({ requesterId, requesterName = "Jennifer Anderson" }) {
    const [categories, setCategories] = useState([]);
    const [relatedSystems, setRelatedSystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [attachments, setAttachments] = useState([]);
    const [ticketNumber, setTicketNumber] = useState("");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [relatedSystemId, setRelatedSystemId] = useState("");
    const [requestedPriority, setRequestedPriority] = useState("");
    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState(null);
    useEffect(() => {
        let active = true;
        async function loadOptions() {
            try {
                const [cats, systems] = await Promise.all([getCategories(), getRelatedSystems()]);
                if (!active)
                    return;
                setCategories(cats);
                setRelatedSystems(systems);
            }
            catch {
                if (active) {
                    setApiError("Unable to load required ticket options.");
                }
            }
            finally {
                if (active) {
                    setLoading(false);
                }
            }
        }
        void loadOptions();
        return () => { active = false; };
    }, []);
    const validate = () => {
        const nextErrors = {};
        if (!categoryId)
            nextErrors.categoryId = "Category is required.";
        if (!relatedSystemId)
            nextErrors.relatedSystemId = "Related System is required.";
        if (summary.trim().length < 5 || summary.trim().length > 120) {
            nextErrors.summary = "Summary must be between 5 and 120 characters.";
        }
        if (description.trim().length < 10 || description.trim().length > 2000) {
            nextErrors.description = "Description must be between 10 and 2000 characters.";
        }
        if (!requestedPriority || !["LOW", "MEDIUM", "HIGH"].includes(requestedPriority)) {
            nextErrors.requestedPriority = "Requested priority is required.";
        }
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async () => {
        if (!validate()) {
            const firstInvalid = document.querySelector("[aria-invalid='true']");
            firstInvalid?.focus();
            return;
        }
        setSubmitting(true);
        setApiError(null);
        try {
            const result = await createTicket({
                categoryId: Number(categoryId),
                relatedSystemId: Number(relatedSystemId),
                summary: summary.trim(),
                description: description.trim(),
                requestedPriority: requestedPriority,
                requesterId,
                attachments,
            });
            const payload = result;
            const normalized = ("data" in payload && payload.data ? payload.data : payload);
            setTicketNumber(normalized.ticketNumber ?? "");
            setFormSubmitted(true);
            setSummary(normalized.summary ?? summary);
        }
        catch (error) {
            setApiError(error instanceof Error ? error.message : "Ticket creation failed.");
        }
        finally {
            setSubmitting(false);
        }
    };
    const firstFieldId = useMemo(() => {
        if (errors.categoryId)
            return "categoryId";
        if (errors.relatedSystemId)
            return "relatedSystemId";
        if (errors.summary)
            return "summary";
        if (errors.description)
            return "description";
        if (errors.requestedPriority)
            return "requestedPriority";
        return "summary";
    }, [errors]);
    useEffect(() => {
        if (firstFieldId) {
            const el = document.getElementById(firstFieldId);
            el?.focus();
        }
    }, [firstFieldId]);
    if (formSubmitted) {
        return (_jsxs("div", { className: "success-panel", children: [_jsx("div", { className: "success-panel__icon", "aria-hidden": "true", children: "\u2713" }), _jsx("h2", { children: "Ticket Created" }), _jsx("div", { className: "success-panel__number", children: ticketNumber || "TKT-2026-000101" }), _jsx("p", { children: summary || "Ticket created successfully." }), _jsxs("div", { className: "success-panel__actions", children: [_jsx("button", { type: "button", className: "primary-button", children: "View Ticket" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => {
                                setFormSubmitted(false);
                                setCategoryId("");
                                setRelatedSystemId("");
                                setRequestedPriority("");
                                setSummary("");
                                setDescription("");
                                setAttachments([]);
                                setTicketNumber("");
                                setErrors({});
                                setApiError(null);
                            }, children: "Create Another Ticket" })] })] }));
    }
    return (_jsxs("div", { className: "page-card", children: [_jsx("h1", { className: "page-title", children: "Create Ticket" }), apiError && _jsx("div", { className: "error-panel", role: "alert", children: apiError }), _jsxs("div", { className: "ticket-grid", children: [_jsxs("div", { className: "form-row form-row--compact", children: [_jsx("label", { className: "field-label", htmlFor: "ticket-number", children: "Ticket Number" }), _jsx("input", { id: "ticket-number", className: "input-field input-field--readonly", value: "Generated after submission", readOnly: true })] }), _jsxs("div", { className: "form-row form-row--compact", children: [_jsx("label", { className: "field-label", htmlFor: "ticket-date", children: "Ticket Date" }), _jsx("input", { id: "ticket-date", className: "input-field input-field--readonly", value: todayLabel, readOnly: true })] }), _jsxs("div", { className: "form-row form-row--compact", children: [_jsx("label", { className: "field-label", htmlFor: "requester-name", children: "Requester" }), _jsx("input", { id: "requester-name", className: "input-field input-field--readonly", value: requesterName, readOnly: true })] })] }), _jsxs("div", { className: "ticket-grid ticket-grid--three", children: [_jsxs("div", { className: "form-row", children: [_jsxs("label", { className: "field-label", htmlFor: "categoryId", children: ["Category ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), _jsxs("select", { id: "categoryId", className: `select-field ${errors.categoryId ? "field-invalid" : ""}`, value: categoryId, "aria-invalid": Boolean(errors.categoryId), "aria-describedby": errors.categoryId ? "categoryId-error" : undefined, onChange: (event) => {
                                    setCategoryId(event.target.value);
                                    setErrors((current) => ({ ...current, categoryId: undefined }));
                                }, disabled: loading, children: [_jsx("option", { value: "", children: "Select category" }), categories.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), errors.categoryId && _jsx("div", { id: "categoryId-error", className: "field-error", children: errors.categoryId })] }), _jsxs("div", { className: "form-row", children: [_jsxs("label", { className: "field-label", htmlFor: "relatedSystemId", children: ["Related System ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), _jsxs("select", { id: "relatedSystemId", className: `select-field ${errors.relatedSystemId ? "field-invalid" : ""}`, value: relatedSystemId, "aria-invalid": Boolean(errors.relatedSystemId), "aria-describedby": errors.relatedSystemId ? "relatedSystemId-error" : undefined, onChange: (event) => {
                                    setRelatedSystemId(event.target.value);
                                    setErrors((current) => ({ ...current, relatedSystemId: undefined }));
                                }, disabled: loading, children: [_jsx("option", { value: "", children: "Select related system" }), relatedSystems.map((item) => (_jsx("option", { value: item.id, children: item.name }, item.id)))] }), errors.relatedSystemId && _jsx("div", { id: "relatedSystemId-error", className: "field-error", children: errors.relatedSystemId })] }), _jsxs("div", { className: "form-row", children: [_jsxs("label", { className: "field-label", htmlFor: "requestedPriority", children: ["Requested Priority ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), _jsxs("select", { id: "requestedPriority", className: `select-field ${errors.requestedPriority ? "field-invalid" : ""}`, value: requestedPriority, "aria-invalid": Boolean(errors.requestedPriority), "aria-describedby": errors.requestedPriority ? "requestedPriority-error" : undefined, onChange: (event) => {
                                    setRequestedPriority(event.target.value);
                                    setErrors((current) => ({ ...current, requestedPriority: undefined }));
                                }, children: [_jsx("option", { value: "", children: "Select priority" }), _jsx("option", { value: "LOW", children: "Low" }), _jsx("option", { value: "MEDIUM", children: "Medium" }), _jsx("option", { value: "HIGH", children: "High" })] }), errors.requestedPriority && _jsx("div", { id: "requestedPriority-error", className: "field-error", children: errors.requestedPriority })] })] }), _jsxs("div", { className: "form-row", children: [_jsxs("label", { className: "field-label", htmlFor: "summary", children: ["Summary ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), _jsx("input", { id: "summary", className: `input-field ${errors.summary ? "field-invalid" : ""}`, type: "text", value: summary, "aria-invalid": Boolean(errors.summary), "aria-describedby": errors.summary ? "summary-error" : undefined, onChange: (event) => {
                            setSummary(event.target.value);
                            setErrors((current) => ({ ...current, summary: undefined }));
                        } }), errors.summary && _jsx("div", { id: "summary-error", className: "field-error", children: errors.summary })] }), _jsxs("div", { className: "form-row", children: [_jsxs("label", { className: "field-label", htmlFor: "description", children: ["Description ", _jsx("span", { "aria-hidden": "true", children: "*" })] }), _jsx("textarea", { id: "description", className: `textarea-field ${errors.description ? "field-invalid" : ""}`, value: description, "aria-invalid": Boolean(errors.description), "aria-describedby": errors.description ? "description-error" : undefined, onChange: (event) => {
                            setDescription(event.target.value);
                            setErrors((current) => ({ ...current, description: undefined }));
                        } }), errors.description && _jsx("div", { id: "description-error", className: "field-error", children: errors.description })] }), _jsxs("div", { className: "form-row", children: [_jsx("label", { className: "field-label", children: "Attachments" }), _jsx(AttachmentPicker, { value: attachments, onChange: setAttachments })] }), _jsxs("div", { className: "ticket-actions", children: [_jsx("button", { type: "button", className: "secondary-button", children: "Cancel" }), _jsx("button", { type: "button", className: "primary-button", disabled: submitting || loading, onClick: handleSubmit, children: submitting ? "Submitting…" : "Create Ticket" })] })] }));
}
