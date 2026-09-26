import { useEffect, useState } from "react";
import { ApiError, getInternalNotes, postInternalNote, type InternalNote } from "../../api";

const MAX_LENGTH = 2000;

/**
 * Staff-only Internal Notes thread (ui-spec.md §6, FR-09/BR-04/BR-14).
 * Deliberately visually distinct from PublicComments: amber-tinted panel,
 * lock icon, and "staff only" copy on every render so private text can
 * never be mistaken for the public thread. Never rendered for Requesters.
 */
export function InternalNotes({ ticketId }: { ticketId: number }) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadNotes() {
      setLoading(true);
      setError(null);
      try {
        const data = await getInternalNotes(ticketId);
        if (!active) return;
        setNotes(data);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load internal notes.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadNotes();
    return () => {
      active = false;
    };
  }, [ticketId, retryToken]);

  const draftError =
    draft !== "" && draft.trim() === ""
      ? "Note must not be empty."
      : draft.trim().length > MAX_LENGTH
        ? `Note must not exceed ${MAX_LENGTH} characters.`
        : null;

  const handlePost = async () => {
    if (draftError || draft.trim() === "" || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await postInternalNote(ticketId, draft.trim());
      setNotes((current) => [...current, created]);
      setDraft("");
    } catch (postFailure) {
      if (postFailure instanceof ApiError && postFailure.code === "VALIDATION_ERROR") {
        setPostError(postFailure.message);
      } else {
        setPostError(postFailure instanceof Error ? postFailure.message : "Unable to post note.");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="detail-section">
      <h3>
        <span aria-hidden="true">🔒 </span>Internal Notes — staff only
      </h3>
      <p className="helper-text">Private to IT Staff and Administrators. Never visible to the requester.</p>
      <div className="internal-notes-panel">
        {loading ? (
          <div className="loading-state" role="status">
            Loading internal notes…
          </div>
        ) : error ? (
          <div className="error-panel" role="alert">
            {error}
            <button type="button" className="secondary-button" onClick={() => setRetryToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <p>No internal notes yet. Record context for the support team here.</p>
          </div>
        ) : (
          <ul className="comment-list">
            {notes.map((note) => (
              <li key={note.id} className="comment-card comment-card--internal">
                <div className="comment-card__header">
                  <strong>{note.author.name}</strong>
                  <span className="comment-card__meta">
                    {note.author.role.replaceAll("_", " ")} ·{" "}
                    {new Date(note.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="comment-card__body">{note.content}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="comment-form">
          <label className="field-label" htmlFor={`note-draft-${ticketId}`}>
            Add an internal note (staff only)
          </label>
          <textarea
            id={`note-draft-${ticketId}`}
            className={`textarea-field ${draftError ? "field-invalid" : ""}`}
            value={draft}
            maxLength={MAX_LENGTH + 100}
            aria-invalid={Boolean(draftError)}
            aria-describedby={draftError ? `note-draft-error-${ticketId}` : undefined}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a private note for the support team…"
          />
          {draftError ? (
            <div id={`note-draft-error-${ticketId}`} className="field-error" role="alert">
              {draftError}
            </div>
          ) : null}
          {postError ? (
            <div className="error-panel" role="alert">
              {postError}
            </div>
          ) : null}
          <div className="ticket-actions">
            <span className="helper-text">{draft.trim().length}/{MAX_LENGTH}</span>
            <button
              type="button"
              className="primary-button"
              disabled={posting || draft.trim() === "" || Boolean(draftError)}
              onClick={() => void handlePost()}
            >
              {posting ? "Posting…" : "Post internal note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
