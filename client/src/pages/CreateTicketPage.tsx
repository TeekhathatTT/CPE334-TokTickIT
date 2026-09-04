import { useEffect, useMemo, useState } from "react";
import { AttachmentPicker } from "../components/AttachmentPicker";
import { getCategories, getRelatedSystems, createTicket } from "../api";
import type { Category, RelatedSystem, Priority } from "../types/ticket";

interface CreateTicketPageProps {
  requesterId: number;
  requesterName?: string;
}

interface FormErrors {
  categoryId?: string;
  relatedSystemId?: string;
  summary?: string;
  description?: string;
  requestedPriority?: string;
}

const todayLabel = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function CreateTicketPage({ requesterId, requesterName = "Jennifer Anderson" }: CreateTicketPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [ticketNumber, setTicketNumber] = useState<string>("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [requestedPriority, setRequestedPriority] = useState<Priority | "">("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [uploadFailures, setUploadFailures] = useState<Array<{ name: string; reason?: string }>>([]);

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        const [cats, systems] = await Promise.all([getCategories(), getRelatedSystems()]);
        if (!active) return;
        setCategories(cats);
        setRelatedSystems(systems);
      } catch {
        if (active) {
          setApiError("Unable to load required ticket options.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOptions();
    return () => { active = false; };
  }, []);

  const validate = () => {
    const nextErrors: FormErrors = {};

    if (!categoryId) nextErrors.categoryId = "Category is required.";
    if (!relatedSystemId) nextErrors.relatedSystemId = "Related System is required.";
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
      const firstInvalid = document.querySelector<HTMLElement>("[aria-invalid='true']") as HTMLElement | null;
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
        requestedPriority: requestedPriority as Priority,
        requesterId,
        attachments,
      });

      const normalized = result as { ticketNumber?: string; summary?: string; attachments?: Array<{ originalFilename: string; uploadFailed?: boolean; reason?: string }> };
      setUploadFailures((normalized.attachments ?? []).filter((attachment) => attachment.uploadFailed).map((attachment) => ({ name: attachment.originalFilename, reason: attachment.reason })));

      setTicketNumber(normalized.ticketNumber ?? "");
      setFormSubmitted(true);
      setSummary(normalized.summary ?? summary);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Ticket creation failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const firstFieldId = useMemo(() => {
    if (errors.categoryId) return "categoryId";
    if (errors.relatedSystemId) return "relatedSystemId";
    if (errors.summary) return "summary";
    if (errors.description) return "description";
    if (errors.requestedPriority) return "requestedPriority";
    return "summary";
  }, [errors]);

  useEffect(() => {
    if (firstFieldId) {
      const el = document.getElementById(firstFieldId) as HTMLElement | null;
      el?.focus();
    }
  }, [firstFieldId]);

  if (formSubmitted) {
    return (
      <div className="success-panel">
        <div className="success-panel__icon" aria-hidden="true">✓</div>
        <h2>Ticket Created</h2>
        <div className="success-panel__number">{ticketNumber || "TKT-2026-000101"}</div>
        <p>{summary || "Ticket created successfully."}</p>
        {uploadFailures.length > 0 && <div className="partial-upload-warning" role="alert"><strong>Some attachments were not uploaded.</strong>{uploadFailures.map((failure) => <div key={failure.name}>{failure.name}: {failure.reason ?? "Upload failed."}</div>)}</div>}
        <div className="success-panel__actions">
          <button type="button" className="primary-button">View Ticket</button>
          <button type="button" className="secondary-button" onClick={() => {
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
            setUploadFailures([]);
          }}>Create Another Ticket</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-card">
      <h1 className="page-title">Create Ticket</h1>
      {apiError && <div className="error-panel" role="alert">{apiError}</div>}

      <div className="ticket-grid">
        <div className="form-row form-row--compact">
          <label className="field-label" htmlFor="ticket-number">Ticket Number</label>
          <input id="ticket-number" className="input-field input-field--readonly" value="Generated after submission" readOnly />
        </div>
        <div className="form-row form-row--compact">
          <label className="field-label" htmlFor="ticket-date">Ticket Date</label>
          <input id="ticket-date" className="input-field input-field--readonly" value={todayLabel} readOnly />
        </div>
        <div className="form-row form-row--compact">
          <label className="field-label" htmlFor="requester-name">Requester</label>
          <input id="requester-name" className="input-field input-field--readonly" value={requesterName} readOnly />
        </div>
      </div>

      <div className="ticket-grid ticket-grid--three">
        <div className="form-row">
          <label className="field-label" htmlFor="categoryId">Category <span aria-hidden="true">*</span></label>
          <select
            id="categoryId"
            className={`select-field ${errors.categoryId ? "field-invalid" : ""}`}
            value={categoryId}
            aria-invalid={Boolean(errors.categoryId)}
            aria-describedby={errors.categoryId ? "categoryId-error" : undefined}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setErrors((current) => ({ ...current, categoryId: undefined }));
            }}
            disabled={loading}
          >
            <option value="">Select category</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {errors.categoryId && <div id="categoryId-error" className="field-error">{errors.categoryId}</div>}
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="relatedSystemId">Related System <span aria-hidden="true">*</span></label>
          <select
            id="relatedSystemId"
            className={`select-field ${errors.relatedSystemId ? "field-invalid" : ""}`}
            value={relatedSystemId}
            aria-invalid={Boolean(errors.relatedSystemId)}
            aria-describedby={errors.relatedSystemId ? "relatedSystemId-error" : undefined}
            onChange={(event) => {
              setRelatedSystemId(event.target.value);
              setErrors((current) => ({ ...current, relatedSystemId: undefined }));
            }}
            disabled={loading}
          >
            <option value="">Select related system</option>
            {relatedSystems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          {errors.relatedSystemId && <div id="relatedSystemId-error" className="field-error">{errors.relatedSystemId}</div>}
        </div>

        <div className="form-row">
          <label className="field-label" htmlFor="requestedPriority">Requested Priority <span aria-hidden="true">*</span></label>
          <select
            id="requestedPriority"
            className={`select-field ${errors.requestedPriority ? "field-invalid" : ""}`}
            value={requestedPriority}
            aria-invalid={Boolean(errors.requestedPriority)}
            aria-describedby={errors.requestedPriority ? "requestedPriority-error" : undefined}
            onChange={(event) => {
              setRequestedPriority(event.target.value as Priority | "");
              setErrors((current) => ({ ...current, requestedPriority: undefined }));
            }}
          >
            <option value="">Select priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          {errors.requestedPriority && <div id="requestedPriority-error" className="field-error">{errors.requestedPriority}</div>}
        </div>
      </div>

      <div className="form-row">
        <label className="field-label" htmlFor="summary">Summary <span aria-hidden="true">*</span></label>
        <input
          id="summary"
          className={`input-field ${errors.summary ? "field-invalid" : ""}`}
          type="text"
          value={summary}
          aria-invalid={Boolean(errors.summary)}
          aria-describedby={errors.summary ? "summary-error" : undefined}
          onChange={(event) => {
            setSummary(event.target.value);
            setErrors((current) => ({ ...current, summary: undefined }));
          }}
        />
        {errors.summary && <div id="summary-error" className="field-error">{errors.summary}</div>}
      </div>

      <div className="form-row">
        <label className="field-label" htmlFor="description">Description <span aria-hidden="true">*</span></label>
        <textarea
          id="description"
          className={`textarea-field ${errors.description ? "field-invalid" : ""}`}
          value={description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : undefined}
          onChange={(event) => {
            setDescription(event.target.value);
            setErrors((current) => ({ ...current, description: undefined }));
          }}
        />
        {errors.description && <div id="description-error" className="field-error">{errors.description}</div>}
      </div>

      <div className="form-row">
        <label className="field-label">Attachments</label>
        <AttachmentPicker value={attachments} onChange={setAttachments} />
      </div>

      <div className="ticket-actions">
        <button type="button" className="secondary-button">Cancel</button>
        <button type="button" className="primary-button" disabled={submitting || loading} onClick={handleSubmit}>
          {submitting ? "Submitting…" : "Create Ticket"}
        </button>
      </div>
    </div>
  );
}
