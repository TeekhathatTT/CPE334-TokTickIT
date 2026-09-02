import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export default function MyTicketsPage({ requesterId }) {
    const [rows, setRows] = useState([]);
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
                if (!response.ok)
                    throw new Error("Failed");
                const payload = await response.json();
                if (!active)
                    return;
                setRows(payload.data ?? []);
            }
            catch {
                if (active) {
                    setRows([]);
                }
            }
            finally {
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
        return _jsx("div", { className: "page-card", children: _jsx("div", { children: "Loading tickets\u2026" }) });
    }
    return (_jsxs("div", { className: "page-card", children: [_jsx("div", { className: "ticket-list-header", children: _jsx("div", { children: _jsx("h1", { className: "page-title", children: "My Tickets" }) }) }), _jsxs("div", { className: "filters-row", children: [_jsx("input", { "aria-label": "Search tickets", className: "input-field", value: search, onChange: (event) => setSearch(event.target.value), placeholder: "Search" }), _jsxs("select", { "aria-label": "Ticket status", className: "select-field", value: status, onChange: (event) => setStatus(event.target.value), children: [_jsx("option", { value: "All", children: "All Status" }), _jsx("option", { value: "NEW", children: "New" }), _jsx("option", { value: "OPEN", children: "Open" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "RESOLVED", children: "Resolved" }), _jsx("option", { value: "PENDING", children: "Pending" })] })] }), filteredRows.length === 0 ? (_jsx("div", { className: "empty-state", children: "No tickets match your filters." })) : (_jsxs("table", { className: "ticket-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Ticket No." }), _jsx("th", { children: "Created Date" }), _jsx("th", { children: "Summary" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Requested Priority" }), _jsx("th", { children: "IT Priority" }), _jsx("th", { children: "Status" }), _jsx("th", { children: "Last Updated" })] }) }), _jsx("tbody", { children: filteredRows.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: row.ticketNumber }), _jsx("td", { children: row.createdAt }), _jsx("td", { children: row.summary }), _jsx("td", { children: row.category }), _jsx("td", { children: row.requestedPriority }), _jsx("td", { children: row.itPriority ?? "-" }), _jsx("td", { children: row.status }), _jsx("td", { children: row.updatedAt ?? row.createdAt })] }, row.id))) })] })), _jsxs("div", { className: "pagination-row", children: [_jsx("button", { type: "button", className: "secondary-button", disabled: page === 1, onClick: () => setPage((previous) => Math.max(1, previous - 1)), children: "Previous" }), _jsxs("span", { children: ["Page ", page] }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => setPage((previous) => previous + 1), children: "Next" }), _jsxs("select", { "aria-label": "Page size", className: "select-field select-field--small", value: pageSize, onChange: (event) => setPageSize(Number(event.target.value)), children: [_jsx("option", { value: 10, children: "10" }), _jsx("option", { value: 20, children: "20" }), _jsx("option", { value: 50, children: "50" })] })] })] }));
}
