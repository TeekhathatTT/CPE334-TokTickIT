import { useEffect, useState } from "react";
import { getRequesterDashboard, type RequesterDashboardData } from "../api";

interface RequesterDashboardPageProps {
  onNavigateMyTickets?: (filters?: Record<string, string | string[]>) => void;
  onCreateTicket?: () => void;
  onSelectTicket?: (ticketId: number) => void;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function RequesterDashboardPage({ onNavigateMyTickets, onCreateTicket, onSelectTicket }: RequesterDashboardPageProps) {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getRequesterDashboard();
        if (!active) return;
        setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retryToken]);

  if (loading) {
    return (
      <div className="page-card">
        <h1 className="page-title">Dashboard</h1>
        <div className="loading-state" role="status">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-card">
        <h1 className="page-title">Dashboard</h1>
        <div className="error-panel" role="alert">
          {error}
          <button type="button" className="secondary-button" onClick={() => setRetryToken((t) => t + 1)}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="page-card">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p>At-a-glance view of your work.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="metric-card" aria-label="Open tickets">
          <div className="metric-card__label">Open tickets</div>
          <div className="metric-card__value">{data.openTickets}</div>
          <div className="metric-card__helper">{data.openTickets === 0 ? "You have no open tickets." : "Tickets not resolved/closed/cancelled"}</div>
          <button type="button" className="link-button" onClick={() => onNavigateMyTickets?.({ status: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] })}>
            View tickets
          </button>
        </article>

        <article className="metric-card" aria-label="Awaiting my response">
          <div className="metric-card__label">Awaiting my response</div>
          <div className="metric-card__value">{data.awaitingMyResponse}</div>
          <div className="metric-card__helper">{data.awaitingMyResponse === 0 ? "Nothing is waiting on you." : "Waiting for requester"}</div>
          <button type="button" className="link-button" onClick={() => onNavigateMyTickets?.({ status: "WAITING_FOR_REQUESTER" })}>
            View tickets
          </button>
        </article>

        <article className="metric-card" aria-label="Recently resolved">
          <div className="metric-card__label">Recently resolved</div>
          <div className="metric-card__value">{data.recentlyResolved}</div>
          <div className="metric-card__helper">{data.recentlyResolved === 0 ? "No tickets resolved in the last 30 days." : "Resolved/Closed in last 30 days"}</div>
          <button type="button" className="link-button" onClick={() => onNavigateMyTickets?.({ status: ["RESOLVED", "CLOSED"], updatedSince: data.recentlyResolvedSince })}>
            View tickets
          </button>
        </article>

        <article className="metric-card" aria-label="Total submitted">
          <div className="metric-card__label">Total submitted</div>
          <div className="metric-card__value">{data.totalSubmitted}</div>
          <div className="metric-card__helper">{data.totalSubmitted === 0 ? "You have not submitted any tickets yet." : "All tickets you submitted"}</div>
          {data.totalSubmitted === 0 ? (
            <button type="button" className="link-button" onClick={() => onCreateTicket?.()}>Create a ticket</button>
          ) : (
            <button type="button" className="link-button" onClick={() => onNavigateMyTickets?.({})}>View tickets</button>
          )}
        </article>
      </div>

      <section className="recent-tickets">
        <h2 className="section-title">Recently updated</h2>
        {data.recentTickets.length === 0 ? (
          <p>No recent tickets.</p>
        ) : (
          <ul className="recent-list">
            {data.recentTickets.map((t) => (
              <li key={t.id} className="recent-list__item">
                <button type="button" className="link-button" onClick={() => onSelectTicket?.(t.id)}>{t.ticketNumber}</button>
                <span className="recent-list__summary">{t.summary}</span>
                <span className={`badge badge--${((t.status as string)||"none").toLowerCase()}`}>{((t.status as string) || '').replaceAll('_', ' ')}</span>
                <span className="recent-list__date">{formatDate(t.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}