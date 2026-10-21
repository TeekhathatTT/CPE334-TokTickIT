import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACTION_RESULTS,
  ApiError,
  createStaffAction,
  getRequesterActions,
  getStaffActions,
  patchStaffAction,
  type ActionTaken,
  type ActionResult,
} from "../../api";

const MIN_DESCRIPTION = 5;
const MAX_DESCRIPTION = 2000;
const MIN_NOTE = 5;
const MAX_NOTE = 1000;
const MAX_ATTACHMENT_NOTES = 500;

const RESULT_LABELS: Record<ActionResult, string> = {
  RESOLVED_STEP: "Resolved step",
  WORKAROUND: "Workaround",
  INFO_REQUESTED: "Info requested",
  ESCALATED: "Escalated",
  NO_FURTHER_ACTION: "No further action",
};

function resultLabel(value: ActionResult): string {
  return RESULT_LABELS[value] ?? value;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export interface ActionsTakenProps {
  ticketId: number;
  /** "staff" renders create/edit/resolve controls; "requester" is read-only. */
  mode: "staff" | "requester";
  /** Authenticated user id (staff mode) — gates the author-only Edit control. */
  currentUserId?: number;
  /** Called after a successful create/edit/resolve so the page can refresh. */
  onChanged?: () => void;
}

interface Draft {
  description: string;
  result: ActionResult;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
}

const EMPTY_DRAFT: Draft = {
  description: "",
  result: "RESOLVED_STEP",
  followUpRequired: false,
  followUpNote: "",
  attachmentNotes: "",
};

function validateDraft(draft: Draft): Record<string, string> {
  const fields: Record<string, string> = {};
  const description = draft.description.trim();
  if (description.length < MIN_DESCRIPTION || description.length > MAX_DESCRIPTION) {
    fields.description = `Description must be between ${MIN_DESCRIPTION} and ${MAX_DESCRIPTION} characters.`;
  }
  if (!ACTION_RESULTS.includes(draft.result)) {
    fields.result = "Select a result.";
  }
  if (draft.followUpRequired) {
    const note = draft.followUpNote.trim();
    if (note.length < MIN_NOTE || note.length > MAX_NOTE) {
      fields.followUpNote = `Follow-up note is required (${MIN_NOTE}–${MAX_NOTE} characters).`;
    }
  } else if (draft.followUpNote.trim().length > 0) {
    fields.followUpNote = "Follow-up note must be empty when follow-up is not required.";
  }
  if (draft.attachmentNotes.trim().length > MAX_ATTACHMENT_NOTES) {
    fields.attachmentNotes = `Attachment reference must be ${MAX_ATTACHMENT_NOTES} characters or fewer.`;
  }
  return fields;
}

/**
 * Live (client-side) field errors. An untouched field is not shown as broken,
 * but the required-when rule for the follow-up note is enforced from the
 * moment the checkbox is ticked (ui-spec.md §2.3).
 */
function liveFieldErrors(draft: Draft, errors: Record<string, string>): Record<string, string> {
  const live: Record<string, string> = {};
  if (draft.description.trim().length > 0 && errors.description) live.description = errors.description;
  if (draft.followUpRequired && errors.followUpNote) live.followUpNote = errors.followUpNote;
  if (draft.attachmentNotes.trim().length > 0 && errors.attachmentNotes) live.attachmentNotes = errors.attachmentNotes;
  return live;
}

function firstError(errors: Record<string, string>): string | undefined {
  return Object.values(errors)[0];
}

function toPayload(draft: Draft) {
  return {
    description: draft.description.trim(),
    result: draft.result,
    followUpRequired: draft.followUpRequired,
    followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : null,
    attachmentNotes: draft.attachmentNotes.trim() === "" ? null : draft.attachmentNotes.trim(),
  };
}

/**
 * Actions Taken thread (ui-spec.md §1, §2.3, §2.4). Visually distinct from
 * Public Comments (neutral) and Internal Notes (amber + lock): white card with
 * a green left-border accent and a wrench/clipboard icon. Staff may create
 * entries, edit their own (author-while-active), and resolve any pending
 * follow-up; Requesters see a read-only list.
 */
export function ActionsTaken({ ticketId, mode, currentUserId, onChanged }: ActionsTakenProps) {
  const [actions, setActions] = useState<ActionTaken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const load = useCallback(async () => {
    const loader = mode === "staff" ? getStaffActions : getRequesterActions;
    return loader(ticketId);
  }, [mode, ticketId]);

  /**
   * Re-read the list without touching the loading state, so a background
   * refresh never blanks the thread that is already on screen.
   */
  const refreshActions = useCallback(async () => {
    const data = await load();
    setActions(data);
    return data;
  }, [load]);

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await load();
        if (active) setActions(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load actions taken.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void run();
    return () => {
      active = false;
    };
  }, [load, retryToken]);

  // ---- accessibility: focus the first invalid control (ui-spec §3) -------
  const [focusRequest, setFocusRequest] = useState<{ target: "create" | "edit"; token: number } | null>(null);
  const createFormRef = useRef<HTMLDivElement | null>(null);
  const editFormRef = useRef<HTMLDivElement | null>(null);

  const requestFocus = (target: "create" | "edit") => {
    setFocusRequest((current) => ({ target, token: (current?.token ?? 0) + 1 }));
  };

  useEffect(() => {
    if (!focusRequest) return;
    const container = focusRequest.target === "create" ? createFormRef.current : editFormRef.current;
    const invalid = container?.querySelector<HTMLElement>(".field-invalid");
    invalid?.focus();
  }, [focusRequest]);

  // ---- create form (staff only) -------------------------------------------
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFields, setCreateFields] = useState<Record<string, string>>({});

  const draftErrors = validateDraft(draft);
  const shownCreateFields = { ...liveFieldErrors(draft, draftErrors), ...createFields };
  const createBlockedBy = firstError(draftErrors);

  const clearCreateFieldError = (field: string) => {
    setCreateFields((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleCreate = async () => {
    const fields = validateDraft(draft);
    setCreateFields(fields);
    if (Object.keys(fields).length > 0 || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createStaffAction(ticketId, toPayload(draft));
      setActions((current) => [...current, created]);
      setDraft(EMPTY_DRAFT);
      setCreateFields({});
      onChanged?.();
    } catch (failure) {
      if (failure instanceof ApiError && failure.fields) {
        setCreateFields(failure.fields);
        requestFocus("create");
      }
      setCreateError(failure instanceof Error ? failure.message : "Unable to record the action.");
    } finally {
      setCreating(false);
    }
  };

  // ---- edit mode (staff, author) ------------------------------------------
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editExpected, setEditExpected] = useState<string>("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [editConflict, setEditConflict] = useState<string | null>(null);
  /** BR-09: the server reports the current version in the conflict payload. */
  const [editConflictUpdatedAt, setEditConflictUpdatedAt] = useState<string | null>(null);
  /** The server's current entry, shown so the user can see what changed. */
  const [editServerRow, setEditServerRow] = useState<ActionTaken | null>(null);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [editRefreshing, setEditRefreshing] = useState(false);

  const editDraftErrors = validateDraft(editDraft);
  const shownEditFields = { ...liveFieldErrors(editDraft, editDraftErrors), ...editFields };
  const editBlockedBy =
    firstError(editDraftErrors) ??
    (editConflict ? "Reload the entry or keep your text before saving again." : undefined);

  const clearEditFieldError = (field: string) => {
    setEditFields((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const beginEdit = (row: ActionTaken) => {
    setEditingId(row.id);
    setEditDraft({
      description: row.description,
      result: row.result,
      followUpRequired: row.followUpRequired,
      // BR-05 keeps the old note on the row after a resolved → off flip. It is
      // history, not a pending note: loading it into the draft would make the
      // form un-saveable (the note must be empty while the flag is off).
      followUpNote: row.followUpRequired ? row.followUpNote ?? "" : "",
      attachmentNotes: row.attachmentNotes ?? "",
    });
    setEditExpected(row.updatedAt);
    setEditError(null);
    setEditFields({});
    setEditConflict(null);
    setEditConflictUpdatedAt(null);
    setEditServerRow(null);
    setEditNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
    setEditFields({});
    setEditConflict(null);
    setEditConflictUpdatedAt(null);
    setEditServerRow(null);
    setEditNotice(null);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    const fields = validateDraft(editDraft);
    setEditFields(fields);
    if (Object.keys(fields).length > 0 || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    setEditConflict(null);
    setEditNotice(null);
    try {
      const updated = await patchStaffAction(ticketId, editingId, {
        ...toPayload(editDraft),
        expectedUpdatedAt: editExpected,
      });
      setActions((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      cancelEdit();
      onChanged?.();
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === "VERSION_CONFLICT") {
        setEditConflict("Someone else changed this entry. Reload the entry to see the current version, or keep your text and retry.");
        const current = failure.data?.currentUpdatedAt;
        setEditConflictUpdatedAt(typeof current === "string" ? current : null);
      } else if (failure instanceof ApiError && failure.fields) {
        setEditFields(failure.fields);
        setEditError(failure.message);
        requestFocus("edit");
      } else {
        setEditError(failure instanceof Error ? failure.message : "Unable to save the entry.");
      }
    } finally {
      setEditSaving(false);
    }
  };

  /**
   * "Reload entry": re-read the entry so the user can see what changed. The
   * draft is never discarded and the next save is re-targeted at the current
   * version, so the conflict is recoverable.
   */
  const reloadEntry = async () => {
    setEditRefreshing(true);
    try {
      const fresh = await refreshActions();
      const row = fresh.find((entry) => entry.id === editingId) ?? null;
      setEditServerRow(row);
      const expected = row?.updatedAt ?? editConflictUpdatedAt;
      if (expected) setEditExpected(expected);
      setEditConflict(null);
      setEditNotice(
        row
          ? "The entry was reloaded. Your wording is still here — compare it with the current entry, then save."
          : "The entry was reloaded. Your wording is still here — save again to apply it.",
      );
    } catch {
      if (editConflictUpdatedAt) setEditExpected(editConflictUpdatedAt);
      setEditNotice("The entry could not be reloaded. Your wording is still here — try again or cancel the edit.");
    } finally {
      setEditRefreshing(false);
    }
  };

  /**
   * "Keep my text": keep the draft and re-target the next save at the
   * version the server reported, so the retry can actually succeed.
   */
  const keepMyText = async () => {
    setEditConflict(null);
    setEditServerRow(null);
    let expected = editConflictUpdatedAt;
    try {
      const fresh = await refreshActions();
      const row = fresh.find((entry) => entry.id === editingId);
      if (row) expected = row.updatedAt;
    } catch {
      // A failed refresh still leaves the server-reported version usable.
    }
    if (expected) setEditExpected(expected);
    setEditNotice("Your wording was kept. Save again to apply it to the current entry.");
  };

  // ---- resolve (staff, any, pending row) ----------------------------------
  const [resolveBusyId, setResolveBusyId] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const resolveFollowUp = async (row: ActionTaken) => {
    setResolveBusyId(row.id);
    setResolveError(null);
    try {
      const updated = await patchStaffAction(ticketId, row.id, {
        markFollowUpResolved: true,
        expectedUpdatedAt: row.updatedAt,
      });
      setActions((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      onChanged?.();
    } catch (failure) {
      setResolveError(failure instanceof Error ? failure.message : "Unable to resolve the follow-up.");
      if (
        failure instanceof ApiError &&
        (failure.code === "VERSION_CONFLICT" || failure.code === "FOLLOW_UP_ALREADY_RESOLVED")
      ) {
        // The row changed underneath us (someone else resolved it first) — re-read
        // the list so the stale "Mark follow-up resolved" control disappears.
        try {
          await refreshActions();
        } catch {
          // The error message above stays on screen; the list keeps its rows.
        }
      }
    } finally {
      setResolveBusyId(null);
    }
  };

  const fieldError = (message?: string) =>
    message ? (
      <div className="field-error" role="alert">
        {message}
      </div>
    ) : null;

  return (
    <div className="detail-section">
      <h3>
        <span aria-hidden="true">🛠 </span>Actions Taken
      </h3>
      <p className="helper-text">
        {mode === "staff"
          ? "The work performed on this ticket. Visible to the requester — keep wording requester-safe."
          : "Recorded by IT — read-only."}
      </p>
      <div className="actions-taken-panel">
        {loading ? (
          <div className="loading-state" role="status">
            Loading actions taken…
          </div>
        ) : error ? (
          <div className="error-panel" role="alert">
            {error}
            <button type="button" className="secondary-button" onClick={() => setRetryToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        ) : actions.length === 0 ? (
          <div className="empty-state">
            <p>No actions recorded yet.</p>
          </div>
        ) : (
          <ul className="comment-list">
            {actions.map((row) => {
              const isAuthor = mode === "staff" && row.performedBy.id === currentUserId;
              const isEditing = editingId === row.id;
              return (
                <li key={row.id} className="comment-card comment-card--action">
                  <div className="comment-card__header">
                    <span className="comment-card__author">
                      <span aria-hidden="true" className="avatar staff">
                        {avatarInitials(row.performedBy.name)}
                      </span>
                      <strong>{row.performedBy.name}</strong>
                      <span className="role-badge">{row.performedBy.role.replaceAll("_", " ")}</span>
                    </span>
                    <span className="comment-card__meta">{formatWhen(row.actionDate)}</span>
                  </div>

                  {isEditing ? (
                    <div className="action-edit" ref={editFormRef}>
                      <label className="field-label" htmlFor={`action-edit-description-${row.id}`}>
                        Description
                      </label>
                      <textarea
                        id={`action-edit-description-${row.id}`}
                        className={`textarea-field ${shownEditFields.description ? "field-invalid" : ""}`}
                        value={editDraft.description}
                        maxLength={MAX_DESCRIPTION + 100}
                        aria-invalid={Boolean(shownEditFields.description)}
                        aria-describedby={shownEditFields.description ? `action-edit-description-error-${row.id}` : undefined}
                        onChange={(event) => {
                          setEditDraft({ ...editDraft, description: event.target.value });
                          clearEditFieldError("description");
                        }}
                      />
                      {shownEditFields.description ? (
                        <div id={`action-edit-description-error-${row.id}`} className="field-error" role="alert">
                          {shownEditFields.description}
                        </div>
                      ) : null}
                      <span className="helper-text">
                        {editDraft.description.trim().length}/{MAX_DESCRIPTION}
                      </span>

                      <label className="field-label" htmlFor={`action-edit-result-${row.id}`}>
                        Result
                      </label>
                      <select
                        id={`action-edit-result-${row.id}`}
                        className={`select-field ${shownEditFields.result ? "field-invalid" : ""}`}
                        value={editDraft.result}
                        aria-invalid={Boolean(shownEditFields.result)}
                        onChange={(event) => {
                          setEditDraft({ ...editDraft, result: event.target.value as ActionResult });
                          clearEditFieldError("result");
                        }}
                      >
                        {ACTION_RESULTS.map((value) => (
                          <option key={value} value={value}>
                            {resultLabel(value)}
                          </option>
                        ))}
                      </select>
                      {shownEditFields.result ? fieldError(shownEditFields.result) : null}

                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          checked={editDraft.followUpRequired}
                          onChange={(event) =>
                            setEditDraft({
                              ...editDraft,
                              followUpRequired: event.target.checked,
                              followUpNote: event.target.checked ? editDraft.followUpNote : "",
                            })
                          }
                        />
                        Follow-up required
                      </label>

                      {editDraft.followUpRequired ? (
                        <>
                          <label className="field-label" htmlFor={`action-edit-note-${row.id}`}>
                            Follow-up note
                          </label>
                          <textarea
                            id={`action-edit-note-${row.id}`}
                            className={`textarea-field ${shownEditFields.followUpNote ? "field-invalid" : ""}`}
                            value={editDraft.followUpNote}
                            maxLength={MAX_NOTE + 100}
                            aria-invalid={Boolean(shownEditFields.followUpNote)}
                            aria-describedby={
                              shownEditFields.followUpNote ? `action-edit-note-error-${row.id}` : undefined
                            }
                            onChange={(event) => {
                              setEditDraft({ ...editDraft, followUpNote: event.target.value });
                              clearEditFieldError("followUpNote");
                            }}
                            placeholder="What needs to be checked, and when?"
                          />
                          <span className="helper-text">
                            {editDraft.followUpNote.trim().length}/{MAX_NOTE}
                          </span>
                        </>
                      ) : null}
                      {shownEditFields.followUpNote ? (
                        <div id={`action-edit-note-error-${row.id}`} className="field-error" role="alert">
                          {shownEditFields.followUpNote}
                        </div>
                      ) : null}

                      <label className="field-label" htmlFor={`action-edit-attachment-${row.id}`}>
                        Attachment reference (optional)
                      </label>
                      <input
                        id={`action-edit-attachment-${row.id}`}
                        className={`input-field ${shownEditFields.attachmentNotes ? "field-invalid" : ""}`}
                        value={editDraft.attachmentNotes}
                        maxLength={MAX_ATTACHMENT_NOTES + 100}
                        aria-invalid={Boolean(shownEditFields.attachmentNotes)}
                        aria-describedby={
                          shownEditFields.attachmentNotes ? `action-edit-attachment-error-${row.id}` : undefined
                        }
                        onChange={(event) => {
                          setEditDraft({ ...editDraft, attachmentNotes: event.target.value });
                          clearEditFieldError("attachmentNotes");
                        }}
                        placeholder="Name a file already attached to this ticket"
                      />
                      <span className="helper-text">
                        Name a file already attached to this ticket — this does not upload anything.
                      </span>
                      {shownEditFields.attachmentNotes ? (
                        <div id={`action-edit-attachment-error-${row.id}`} className="field-error" role="alert">
                          {shownEditFields.attachmentNotes}
                        </div>
                      ) : null}

                      <p className="helper-text">Last updated {formatWhen(row.updatedAt)}.</p>
                      {editNotice ? (
                        <div className="success-panel success-panel--inline" role="status">
                          {editNotice}
                        </div>
                      ) : null}
                      {editConflict ? (
                        <div className="warning-panel" role="alert">
                          <p>{editConflict}</p>
                          <div className="ticket-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={editRefreshing}
                              onClick={() => void reloadEntry()}
                            >
                              {editRefreshing ? "Reloading…" : "Reload entry"}
                            </button>
                            <button type="button" className="primary-button" onClick={() => void keepMyText()}>
                              Keep my text
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {editServerRow ? (
                        <div className="comment-card comment-card--action">
                          <div className="comment-card__header">
                            <span className="comment-card__author">
                              <strong>Current entry (from the server)</strong>
                            </span>
                            <span className="comment-card__meta">Last updated {formatWhen(editServerRow.updatedAt)}</span>
                          </div>
                          <p className="comment-card__body">{editServerRow.description}</p>
                        </div>
                      ) : null}
                      {fieldError(editError ?? undefined)}
                      {editBlockedBy ? (
                        <p className="helper-text" id={`action-edit-submit-hint-${row.id}`}>
                          {editBlockedBy}
                        </p>
                      ) : null}
                      <div className="ticket-actions">
                        <button type="button" className="secondary-button" onClick={cancelEdit}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          disabled={editSaving || Boolean(editBlockedBy)}
                          aria-describedby={editBlockedBy ? `action-edit-submit-hint-${row.id}` : undefined}
                          onClick={() => void saveEdit()}
                        >
                          {editSaving ? "Saving…" : "Save changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="comment-card__body">{row.description}</p>
                      <div className="action-badges">
                        <span className="result-badge">{resultLabel(row.result)}</span>
                        {row.followUpRequired ? (
                          row.followUpResolvedAt ? (
                            <span className="followup-badge followup-badge--resolved">Follow-up resolved</span>
                          ) : (
                            <span className="followup-badge followup-badge--pending">Follow-up required</span>
                          )
                        ) : null}
                      </div>
                      {row.attachmentNotes ? (
                        <p className="helper-text">
                          <span aria-hidden="true">📎 </span>Attachment reference: {row.attachmentNotes}
                        </p>
                      ) : null}
                      {row.followUpNote ? <p className="comment-card__body">Follow-up: {row.followUpNote}</p> : null}
                      {row.followUpResolvedAt ? (
                        <p className="helper-text">
                          Resolved {formatWhen(row.followUpResolvedAt)}
                          {row.resolvedBy ? ` by ${row.resolvedBy.name}` : ""}.
                        </p>
                      ) : null}

                      {mode === "staff" ? (
                        <div className="ticket-actions">
                          {isAuthor ? (
                            <button type="button" className="secondary-button" onClick={() => beginEdit(row)}>
                              Edit
                            </button>
                          ) : null}
                          {row.followUpRequired && !row.followUpResolvedAt ? (
                            <button
                              type="button"
                              className="primary-button"
                              disabled={resolveBusyId === row.id}
                              onClick={() => void resolveFollowUp(row)}
                            >
                              {resolveBusyId === row.id ? "Resolving…" : "Mark follow-up resolved"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {resolveError ? (
          <div className="error-panel" role="alert">
            {resolveError}
          </div>
        ) : null}

        {mode === "staff" ? (
          <div className="comment-form action-form" ref={createFormRef}>
            <label className="field-label" htmlFor={`action-description-${ticketId}`}>
              Description
            </label>
            <textarea
              id={`action-description-${ticketId}`}
              className={`textarea-field ${shownCreateFields.description ? "field-invalid" : ""}`}
              value={draft.description}
              maxLength={MAX_DESCRIPTION + 100}
              aria-invalid={Boolean(shownCreateFields.description)}
              aria-describedby={shownCreateFields.description ? `action-description-error-${ticketId}` : undefined}
              onChange={(event) => {
                setDraft({ ...draft, description: event.target.value });
                clearCreateFieldError("description");
              }}
              placeholder="Describe the action performed…"
            />
            {shownCreateFields.description ? (
              <div id={`action-description-error-${ticketId}`} className="field-error" role="alert">
                {shownCreateFields.description}
              </div>
            ) : null}
            <span className="helper-text">
              {draft.description.trim().length}/{MAX_DESCRIPTION}
            </span>

            <label className="field-label" htmlFor={`action-result-${ticketId}`}>
              Result
            </label>
            <select
              id={`action-result-${ticketId}`}
              className={`select-field ${shownCreateFields.result ? "field-invalid" : ""}`}
              value={draft.result}
              aria-invalid={Boolean(shownCreateFields.result)}
              onChange={(event) => {
                setDraft({ ...draft, result: event.target.value as ActionResult });
                clearCreateFieldError("result");
              }}
            >
              {ACTION_RESULTS.map((value) => (
                <option key={value} value={value}>
                  {resultLabel(value)}
                </option>
              ))}
            </select>
            {shownCreateFields.result ? fieldError(shownCreateFields.result) : null}

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.followUpRequired}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    followUpRequired: event.target.checked,
                    followUpNote: event.target.checked ? draft.followUpNote : "",
                  })
                }
              />
              Follow-up required
            </label>

            {draft.followUpRequired ? (
              <>
                <label className="field-label" htmlFor={`action-note-${ticketId}`}>
                  Follow-up note
                </label>
                <textarea
                  id={`action-note-${ticketId}`}
                  className={`textarea-field ${shownCreateFields.followUpNote ? "field-invalid" : ""}`}
                  value={draft.followUpNote}
                  maxLength={MAX_NOTE + 100}
                  aria-invalid={Boolean(shownCreateFields.followUpNote)}
                  aria-describedby={shownCreateFields.followUpNote ? `action-note-error-${ticketId}` : undefined}
                  onChange={(event) => {
                    setDraft({ ...draft, followUpNote: event.target.value });
                    clearCreateFieldError("followUpNote");
                  }}
                  placeholder="What needs to be checked, and when?"
                />
                {shownCreateFields.followUpNote ? (
                  <div id={`action-note-error-${ticketId}`} className="field-error" role="alert">
                    {shownCreateFields.followUpNote}
                  </div>
                ) : null}
                <span className="helper-text">
                  {draft.followUpNote.trim().length}/{MAX_NOTE}
                </span>
              </>
            ) : null}

            <label className="field-label" htmlFor={`action-attachment-${ticketId}`}>
              Attachment reference (optional)
            </label>
            <input
              id={`action-attachment-${ticketId}`}
              className={`input-field ${shownCreateFields.attachmentNotes ? "field-invalid" : ""}`}
              value={draft.attachmentNotes}
              maxLength={MAX_ATTACHMENT_NOTES + 100}
              aria-invalid={Boolean(shownCreateFields.attachmentNotes)}
              aria-describedby={
                shownCreateFields.attachmentNotes ? `action-attachment-error-${ticketId}` : undefined
              }
              onChange={(event) => {
                setDraft({ ...draft, attachmentNotes: event.target.value });
                clearCreateFieldError("attachmentNotes");
              }}
              placeholder="Name a file already attached to this ticket"
            />
            <span className="helper-text">
              Name a file already attached to this ticket — this does not upload anything.
            </span>
            {shownCreateFields.attachmentNotes ? (
              <div id={`action-attachment-error-${ticketId}`} className="field-error" role="alert">
                {shownCreateFields.attachmentNotes}
              </div>
            ) : null}

            {createError ? (
              <div className="error-panel" role="alert">
                {createError}
              </div>
            ) : null}

            {createBlockedBy ? (
              <p className="helper-text" id={`action-submit-hint-${ticketId}`}>
                {createBlockedBy}
              </p>
            ) : null}
            <div className="ticket-actions">
              <button
                type="button"
                className="primary-button"
                disabled={creating || Boolean(createBlockedBy)}
                aria-describedby={createBlockedBy ? `action-submit-hint-${ticketId}` : undefined}
                onClick={() => void handleCreate()}
              >
                {creating ? "Recording…" : "Record action"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
