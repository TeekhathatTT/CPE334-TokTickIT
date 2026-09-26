import { useEffect, useState } from "react";
import { getStaffTickets, type StaffQueueMeta, type StaffQueueRow } from "../../api";

interface TicketQueuePageProps {
  onSelectTicket?: (ticketId: number) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const badge = (value: string | null | undefined) => (
  <span className={`badge badge--${(value ?? "none").toLowerCase()}`}>{value?.replaceAll("_", " ") ?? "None"}</span>
);

const STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];

/**
 * IT Staff Ticket Queue (ui-spec.md §5, FR-07): searchable, filterable,
 * sortable, paginated table with stacked-card representation on small
 * screens (same responsive pattern as My Tickets). Columns follow ui-spec
 * §5 exactly; no description mega-column.
 */
export function TicketQueuePage({ onSelectTicket }: TicketQueuePageProps) {
  const [rows, setRows] = useState<StaffQueueRow[]>([]);
  const [meta, setMeta] = useState<StaffQueueMeta>({
    page: 1, pageSize: 20, totalItems: 0, totalPages: 0, queueTotal: 0, isEmpty: true, isNoResults: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [itPriority, setItPriority] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [retryToken, setRetryToken] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      setLoading(true);
      setError(null);
      try {
        const result = await getStaffTickets({
          search, status, requestedPriority, itPriority, categoryId, ownerId, sort, order, page, pageSize,
        });
        if (!active) return;
        setRows(result.data);
        setMeta(result.meta);
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load the ticket queue.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQueue();
    return () => { active = false; };
  }, [search, status, requestedPriority, itPriority, categoryId, ownerId, sort, order, page, pageSize, retryToken]);

  const clearFilters = () => {
    setSearch(""); setStatus(""); setRequestedPriority(""); setItPriority("");
    setCategoryId(""); setOwnerId(""); setPage(1);
  };
  const toggleSort = (field: string) => {
    setPage(1);
    if (sort === field) setOrder((current) => (current === "asc" ? "desc" : "asc"));
    else { setSort(field); setOrder("asc"); }
  };
  const sortLabel = (field: string) => (sort === field ? `, sorted ${order === "asc" ? "ascending" : "descending"}` : "");

  if (loading) {
    return (
      <div className="page-card">
        <h1 className="page-title">Ticket Queue</h1>
        <div className="loading-state" role="status">Loading ticket queue…</div>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">Ticket Queue</h1>
          <p>Find and open work across all requesters. {meta.queueTotal} ticket{meta.queueTotal === 1 ? "" : "s"} in queue.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary-button" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      <button
        type="button"
        className="filters-toggle secondary-button"
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
      >
        Filters
      </button>
      <div className={`filters-row ${filtersOpen ? "filters-row--open" : ""}`}>
        <input
          aria-label="Search queue"
          className="input-field"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Number, summary, description, requester"
        />
        <select aria-label="Queue status" className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select aria-label="Queue requested priority" className="select-field" value={requestedPriority} onChange={(event) => { setRequestedPriority(event.target.value); setPage(1); }}>
          <option value="">All Requested Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <select aria-label="Queue IT priority" className="select-field" value={itPriority} onChange={(event) => { setItPriority(event.target.value); setPage(1); }}>
          <option value="">All IT Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <input
          aria-label="Category ID"
          className="input-field"
          value={categoryId}
          inputMode="numeric"
          onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}
          placeholder="Category ID"
        />
        <input
          aria-label="Owner filter"
          className="input-field"
          value={ownerId}
          onChange={(event) => { setOwnerId(event.target.value); setPage(1); }}
          placeholder='Owner ID or "unassigned"'
        />
      </div>

      {error ? (
        <div className="error-panel" role="alert">
          {error}
          <button type="button" className="secondary-button" onClick={() => setRetryToken((token) => token + 1)}>Retry</button>
        </div>
      ) : meta.isEmpty ? (
        <div className="empty-state">
          <div aria-hidden="true">□</div>
          <p>No tickets in the queue yet.</p>
        </div>
      ) : meta.isNoResults ? (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
          <button type="button" className="secondary-button" onClick={clearFilters}>Clear Filters</button>
        </div>
      ) : (
        <div className="ticket-table-wrap">
          <table className="ticket-table">
            <thead>
              <tr>
                <th><button type="button" className="sort-button" aria-label={`Sort by ticket number${sortLabel("ticketNumber")}`} onClick={() => toggleSort("ticketNumber")}>Ticket No. {sort === "ticketNumber" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th><button type="button" className="sort-button" aria-label={`Sort by created date${sortLabel("createdAt")}`} onClick={() => toggleSort("createdAt")}>Created Date {sort === "createdAt" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th>Summary</th>
                <th>Category</th>
                <th><button type="button" className="sort-button" aria-label={`Sort by requested priority${sortLabel("requestedPriority")}`} onClick={() => toggleSort("requestedPriority")}>Requested Priority {sort === "requestedPriority" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th><button type="button" className="sort-button" aria-label={`Sort by IT priority${sortLabel("itPriority")}`} onClick={() => toggleSort("itPriority")}>IT Priority {sort === "itPriority" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th><button type="button" className="sort-button" aria-label={`Sort by status${sortLabel("status")}`} onClick={() => toggleSort("status")}>Current Status {sort === "status" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th><button type="button" className="sort-button" aria-label={`Sort by owner${sortLabel("owner")}`} onClick={() => toggleSort("owner")}>Ticket Owner {sort === "owner" && (order === "asc" ? "↑" : "↓")}</button></th>
                <th><button type="button" className="sort-button" aria-label={`Sort by last updated${sortLabel("updatedAt")}`} onClick={() => toggleSort("updatedAt")}>Last Updated {sort === "updatedAt" && (order === "asc" ? "↑" : "↓")}</button></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><button type="button" className="link-button" onClick={() => onSelectTicket?.(row.id)}>{row.ticketNumber}</button></td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{row.summary}</td>
                  <td>{row.category}</td>
                  <td>{badge(row.requestedPriority)}</td>
                  <td>{badge(row.itPriority)}</td>
                  <td>{badge(row.status)}</td>
                  <td>{row.owner ? row.owner.name : "Unassigned"}</td>
                  <td>{formatDate(row.updatedAt ?? row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !meta.isEmpty && !meta.isNoResults && (
        <div className="ticket-cards">
          {rows.map((row) => (
            <article className="ticket-card" key={row.id}>
              <div className="ticket-card__header">
                <button type="button" className="link-button" onClick={() => onSelectTicket?.(row.id)}>{row.ticketNumber}</button>
                {badge(row.status)}
              </div>
              <p className="ticket-card__summary">{row.summary}</p>
              <div className="ticket-card__grid">
                <span>Owner<strong>{row.owner ? row.owner.name : "Unassigned"}</strong></span>
                <span>Requested<strong>{badge(row.requestedPriority)}</strong></span>
                <span>IT Priority<strong>{badge(row.itPriority)}</strong></span>
                <span>Last Updated<strong>{formatDate(row.updatedAt ?? row.createdAt)}</strong></span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>
          Previous
        </button>
        <span>Showing {meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1} to {Math.min(meta.page * meta.pageSize, meta.totalItems)} of {meta.totalItems} tickets · Page {meta.page} of {meta.totalPages}</span>
        <button type="button" className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((previous) => Math.min(meta.totalPages, previous + 1))}>
          Next
        </button>
        <select aria-label="Page size" className="select-field select-field--small" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
}
