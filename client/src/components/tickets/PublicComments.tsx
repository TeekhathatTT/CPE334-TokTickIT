import { useEffect, useState } from "react";
import { ApiError, getComments, postComment, type PublicComment } from "../../api";

const MAX_LENGTH = 2000;

/**
 * Requester-visible Public Comments thread (ui-spec.md §4, FR-06/FR-09):
 * append-only list plus a post form with blank/length validation. Internal
 * Notes are a separate staff-only surface and are never rendered here.
 */
export function PublicComments({ ticketId }: { ticketId: number }) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadComments() {
      setLoading(true);
      setError(null);
      try {
        const data = await getComments(ticketId);
        if (!active) return;
        setComments(data);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load comments.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadComments();
    return () => {
      active = false;
    };
  }, [ticketId, retryToken]);

  const draftError =
    draft !== "" && draft.trim() === ""
      ? "Comment must not be empty."
      : draft.trim().length > MAX_LENGTH
        ? `Comment must not exceed ${MAX_LENGTH} characters.`
        : null;

  const handlePost = async () => {
    if (draftError || draft.trim() === "" || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await postComment(ticketId, draft.trim());
      setComments((current) => [...current, created]);
      setDraft("");
    } catch (postFailure) {
      if (postFailure instanceof ApiError && postFailure.code === "VALIDATION_ERROR") {
        setPostError(postFailure.message);
      } else {
        setPostError(postFailure instanceof Error ? postFailure.message : "Unable to post comment.");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="detail-section">
      <h3>Public Comments</h3>
      <div className="comment-panel">
        {loading ? (
          <div className="loading-state" role="status">
            Loading comments…
          </div>
        ) : error ? (
          <div className="error-panel" role="alert">
            {error}
            <button type="button" className="secondary-button" onClick={() => setRetryToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="empty-state">
            <p>No public comments yet. Be the first to add an update.</p>
          </div>
        ) : (
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-card">
                <div className="comment-card__header">
                  <strong>{comment.author.name}</strong>
                  <span className="comment-card__meta">
                    {comment.author.role.replaceAll("_", " ")} ·{" "}
                    {new Date(comment.createdAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="comment-card__body">{comment.content}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="comment-form">
          <label className="field-label" htmlFor={`comment-draft-${ticketId}`}>
            Add a public comment
          </label>
          <textarea
            id={`comment-draft-${ticketId}`}
            className={`textarea-field ${draftError ? "field-invalid" : ""}`}
            value={draft}
            maxLength={MAX_LENGTH + 100}
            aria-invalid={Boolean(draftError)}
            aria-describedby={draftError ? `comment-draft-error-${ticketId}` : undefined}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write an update visible to you and the support team…"
          />
          {draftError ? (
            <div id={`comment-draft-error-${ticketId}`} className="field-error" role="alert">
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
              {posting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
