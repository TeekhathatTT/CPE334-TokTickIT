import { useEffect, useState } from "react";
import { getRequesters } from "../api";
import type { Requester } from "../types/ticket";

interface RequesterSelectionPageProps {
  selectedRequesterId: number | null;
  onRequesterChange: (requesterId: number) => void;
  onContinue: (requesterId: number, requesterName: string) => void;
}

export function RequesterSelectionPage({
  selectedRequesterId,
  onRequesterChange,
  onContinue,
}: RequesterSelectionPageProps) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localSelection, setLocalSelection] = useState<number | null>(selectedRequesterId);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadRequesters() {
      setLoading(true);
      setError(null);

      try {
        const data = await getRequesters();
        if (!active) {
          return;
        }

        setRequesters(data);
      } catch (requesterError) {
        if (!active) {
          return;
        }

        setError(
          requesterError instanceof Error
            ? requesterError.message
            : "Unable to load requesters.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRequesters();

    return () => {
      active = false;
    };
  }, [retryToken]);

  const hasRequesters = requesters.length > 0;
  const selectedValue = localSelection ?? selectedRequesterId ?? "";

  return (
    <div className="selection-page">
      <div className="selection-card">
        <div className="selection-card__icon" aria-hidden="true">
          🏢
        </div>
        <h1 className="selection-card__title">Select Development Requester</h1>

        <p className="selection-card__subtitle">
          Select the requester used for Lab 2 testing.
        </p>

        <label className="field-label" htmlFor="development-requester">
          Development Requester <span aria-hidden="true">*</span>
        </label>

        {loading ? (
          <div className="field-skeleton" aria-label="Loading development requesters" />
        ) : error ? (
          <div className="error-panel" role="alert">
            <strong>Unable to load requesters.</strong>
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={() => setRetryToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        ) : !hasRequesters ? (
          <div className="error-panel" role="alert">
            <strong>No active development requesters are available.</strong>
            <p>Contact an administrator.</p>
          </div>
        ) : (
          <select
            id="development-requester"
            className="select-field"
            value={selectedValue}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              setLocalSelection(nextValue);
              onRequesterChange(nextValue);
            }}
            aria-describedby="requester-help-text"
          >
            <option value="" disabled>
              Select a requester
            </option>
            {requesters.map((requester) => (
              <option key={requester.id} value={requester.id}>
                {requester.name}
              </option>
            ))}
          </select>
        )}

        <div className="helper-text" id="requester-help-text">
          Only active development requesters are shown.
        </div>
        <div className="helper-text helper-text--muted">Authentication coming in Lab 3.</div>

        <div className="selection-actions">
          <button type="button" className="secondary-button">
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!localSelection || loading || !!error || !hasRequesters}
            onClick={() => {
              if (localSelection) {
                const requester = requesters.find((item) => item.id === localSelection);
                onContinue(localSelection, requester?.name ?? "Requester");
              }
            }}
          >
            → Continue
          </button>
        </div>
      </div>
    </div>
  );
}
