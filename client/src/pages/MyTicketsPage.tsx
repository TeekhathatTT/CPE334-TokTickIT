import { useEffect, useState } from "react";
import { getCategories, getTickets, type TicketListMeta, type TicketListRow } from "../api";
import type { Category } from "../types/ticket";

interface MyTicketsPageProps {
  requesterId: number;
  onCreateTicket?: () => void;
  onSelectTicket?: (ticketId: number) => void;
}

const formatDate = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const badge = (value: string | null | undefined) => <span className={`badge badge--${(value ?? "none").toLowerCase()}`}>{value?.replaceAll("_", " ") ?? "None"}</span>;

export default function MyTicketsPage({ requesterId, onCreateTicket, onSelectTicket }: MyTicketsPageProps) {
  const [rows, setRows] = useState<TicketListRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState<TicketListMeta>({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1, isEmpty: false, isNoResults: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [itPriority, setItPriority] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      setError(null);
      try {
        const result = await getTickets(requesterId, { search, category, requestedPriority, itPriority, status, sort, order, page, pageSize });
        if (!active) return;
        setRows(result.data);
        setMeta(result.meta);
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load tickets.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTickets();
    return () => { active = false; };
  }, [requesterId, search, category, requestedPriority, itPriority, status, sort, order, page, pageSize]);

  useEffect(() => { void getCategories().then(setCategories).catch(() => undefined); }, []);
  const clearFilters = () => { setSearch(""); setCategory(""); setRequestedPriority(""); setItPriority(""); setStatus(""); setPage(1); };
  const toggleSort = (field: string) => { setPage(1); if (sort === field) setOrder((current) => current === "asc" ? "desc" : "asc"); else { setSort(field); setOrder("asc"); } };
  const sortLabel = (field: string) => sort === field ? `, sorted ${order === "asc" ? "ascending" : "descending"}` : "";

  if (loading) {
    return <div className="page-card"><div className="loading-state" role="status">Loading tickets…</div></div>;
  }

  return (
    <div className="page-card">
      <div className="ticket-list-header">
          <div><h1 className="page-title">My Tickets</h1><p>Review and track your submitted tickets.</p></div>
          <div className="header-actions"><button type="button" className="secondary-button" onClick={clearFilters}>Clear Filters</button><button type="button" className="primary-button" onClick={onCreateTicket}>Create Ticket</button></div>
      </div>

      <div className="filters-row">
        <input
          aria-label="Search tickets"
          className="input-field"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Ticket Number or Summary"
        />
        <select aria-label="Category" className="select-field" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All Categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Requested priority" className="select-field" value={requestedPriority} onChange={(event) => { setRequestedPriority(event.target.value); setPage(1); }}><option value="">All Requested Priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
        <select aria-label="IT priority" className="select-field" value={itPriority} onChange={(event) => { setItPriority(event.target.value); setPage(1); }}><option value="">All IT Priorities</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select>
        <select aria-label="Ticket status" className="select-field" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {error ? <div className="error-panel" role="alert">{error}<button type="button" className="secondary-button" onClick={() => setPage((current) => current)}>Retry</button></div> : meta.isEmpty ? (
        <div className="empty-state"><div aria-hidden="true">□</div><p>You have no tickets yet.</p><button type="button" className="primary-button" onClick={onCreateTicket}>Create your first ticket</button></div>
      ) : meta.isNoResults ? (
        <div className="empty-state"><p>No tickets match your filters.</p><button type="button" className="secondary-button" onClick={clearFilters}>Clear Filters</button></div>
      ) : (
        <table className="ticket-table">
          <thead>
            <tr>
              <th><button type="button" className="sort-button" aria-label={`Sort by ticket number${sortLabel("ticketNumber")}`} onClick={() => toggleSort("ticketNumber")}>Ticket No. {sort === "ticketNumber" && (order === "asc" ? "↑" : "↓")}</button></th>
              <th><button type="button" className="sort-button" aria-label={`Sort by created date${sortLabel("createdAt")}`} onClick={() => toggleSort("createdAt")}>Created Date {sort === "createdAt" && (order === "asc" ? "↑" : "↓")}</button></th>
              <th>Summary</th>
              <th>Category</th>
              <th>Requested Priority</th><th>IT Priority</th>
              <th>Status</th>
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
                <td>{badge(row.requestedPriority)}</td><td>{badge(row.itPriority)}</td><td>{badge(row.status)}</td>
                <td>{formatDate(row.updatedAt ?? row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>
          Previous
        </button>
        <span>Showing {meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1} to {Math.min(meta.page * meta.pageSize, meta.totalItems)} of {meta.totalItems} tickets · Page {meta.page} of {meta.totalPages}</span>
        <button type="button" className="secondary-button" disabled={page >= meta.totalPages} onClick={() => setPage((previous) => Math.min(meta.totalPages, previous + 1))}>
          Next
        </button>
        <select aria-label="Page size" className="select-field select-field--small" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
}
