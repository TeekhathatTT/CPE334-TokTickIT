import { useEffect, useState } from "react";
import { getStaffDashboard, type StaffDashboardData } from "../../api";

interface StaffDashboardPageProps {
  onNavigateQueue?: (filters?: Record<string, string | string[]>) => void;
  userRole?: string;
}

export default function StaffDashboardPage({ onNavigateQueue, userRole }: StaffDashboardPageProps) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStaffDashboard();
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

  const isAdmin = userRole === "ADMINISTRATOR";

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

  const linkOrDisabled = (filters: Record<string, string | string[]>, content: string) => {
    if (isAdmin) {
      return <div className="metric-card__helper">Sign in as IT Staff to open the queue — administrators have no queue access.</div>;
    }
    return (
      <button type="button" className="link-button" onClick={() => onNavigateQueue?.(filters)}>
        {content}
      </button>
    );
  };

  return (
    <div className="page-card">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p>At-a-glance view of queue work.</p>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--staff">
        <article className="metric-card" aria-label="Unassigned active">
          <div className="metric-card__label">Unassigned active</div>
          <div className="metric-card__value">{data.unassignedActive}</div>
          <div className="metric-card__helper">{data.unassignedActive === 0 ? "Queue is fully assigned." : "Unassigned tickets not closed/cancelled"}</div>
          {linkOrDisabled({ ownerId: "unassigned", status: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] }, "View queue")}
        </article>

        <article className="metric-card" aria-label="Assigned to me">
          <div className="metric-card__label">Assigned to me</div>
          <div className="metric-card__value">{data.assignedToMe}</div>
          <div className="metric-card__helper">{data.assignedToMe === 0 ? "Nothing is assigned to you." : "Tickets assigned to you"}</div>
          {linkOrDisabled({ ownerId: "me", status: ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "REOPENED"] }, "View queue")}
        </article>

        <article className="metric-card" aria-label="Waiting for requester">
          <div className="metric-card__label">Waiting for requester</div>
          <div className="metric-card__value">{data.waitingForRequester}</div>
          <div className="metric-card__helper">{data.waitingForRequester === 0 ? "No tickets are waiting on requesters." : "Awaiting requester response"}</div>
          {linkOrDisabled({ status: "WAITING_FOR_REQUESTER" }, "View queue")}
        </article>

        <article className="metric-card" aria-label="Pending follow-up">
          <div className="metric-card__label">Pending follow-up</div>
          <div className="metric-card__value">{data.pendingFollowUp}</div>
          <div className="metric-card__helper">{data.pendingFollowUp === 0 ? "No pending follow-ups." : "Tickets with unresolved follow-up"}</div>
          {linkOrDisabled({ hasPendingFollowUp: "true" }, "View queue")}
        </article>

        <article className="metric-card" aria-label="Resolved pending close">
          <div className="metric-card__label">Resolved pending close</div>
          <div className="metric-card__value">{data.resolvedPendingClose}</div>
          <div className="metric-card__helper">{data.resolvedPendingClose === 0 ? "Nothing is waiting to be closed." : "Resolved tickets"}</div>
          {linkOrDisabled({ status: "RESOLVED" }, "View queue")}
        </article>

        <article className="metric-card" aria-label="New today">
          <div className="metric-card__label">New today</div>
          <div className="metric-card__value">{data.newToday}</div>
          <div className="metric-card__helper">{data.newToday === 0 ? "No new tickets today." : "Created today (UTC)"}</div>
          {linkOrDisabled({ status: "NEW", createdSince: data.newTodaySince }, "View queue")}
        </article>
      </div>
    </div>
  );
}
