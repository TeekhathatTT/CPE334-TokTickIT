import { useEffect, useState } from "react";

interface TicketRow {
  id: number;
  ticketNumber: string;
  summary: string;
  category: string;
  requestedPriority: string;
  itPriority?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

interface MyTicketsPageProps {
  requesterId: number;
}

export default function MyTicketsPage({ requesterId }: MyTicketsPageProps) {
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:3000/api/tickets?x-requester-id=${requesterId}&page=${page}&pageSize=${pageSize}`);
        if (!response.ok) throw new Error("Failed");
        const payload = await response.json();
        if (!active) return;
        setRows(payload.data ?? []);
      } catch {
        if (active) {
          setRows([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTickets();
    return () => { active = false; };
  }, [requesterId, page, pageSize]);

  const filteredRows = rows.filter((row) => {
    const searchMatch = !search || row.summary.toLowerCase().includes(search.toLowerCase()) || row.ticketNumber.toLowerCase().includes(search.toLowerCase());
    const statusMatch = status === "All" || row.status === status;
    return searchMatch && statusMatch;
  });

  if (loading) {
    return <div className="page-card"><div>Loading tickets…</div></div>;
  }

  return (
    <div className="page-card">
      <div className="ticket-list-header">
        <div>
          <h1 className="page-title">My Tickets</h1>
        </div>
      </div>

      <div className="filters-row">
        <input
          aria-label="Search tickets"
          className="input-field"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
        />
        <select aria-label="Ticket status" className="select-field" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="All">All Status</option>
          <option value="NEW">New</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <div className="empty-state">No tickets match your filters.</div>
      ) : (
        <table className="ticket-table">
          <thead>
            <tr>
              <th>Ticket No.</th>
              <th>Created Date</th>
              <th>Summary</th>
              <th>Category</th>
              <th>Requested Priority</th>
              <th>IT Priority</th>
              <th>Status</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>{row.ticketNumber}</td>
                <td>{row.createdAt}</td>
                <td>{row.summary}</td>
                <td>{row.category}</td>
                <td>{row.requestedPriority}</td>
                <td>{row.itPriority ?? "-"}</td>
                <td>{row.status}</td>
                <td>{row.updatedAt ?? row.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination-row">
        <button type="button" className="secondary-button" disabled={page === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>
          Previous
        </button>
        <span>Page {page}</span>
        <button type="button" className="secondary-button" onClick={() => setPage((previous) => previous + 1)}>
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
