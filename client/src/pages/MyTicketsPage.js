import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getCategories, getTickets } from "../api";
const formatDate = (value) => new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const badge = (value) => _jsx("span", { className: `badge badge--${(value ?? "none").toLowerCase()}`, children: value?.replaceAll("_", " ") ?? "None" });
export default function MyTicketsPage({ requesterId, onCreateTicket, onSelectTicket }) {
    const [rows, setRows] = useState([]);
    const [categories, setCategories] = useState([]);
    const [meta, setMeta] = useState({ page: 1, pageSize: 10, totalItems: 0, totalPages: 1, isEmpty: false, isNoResults: false });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");
    const [requestedPriority, setRequestedPriority] = useState("");
    const [itPriority, setItPriority] = useState("");
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState("createdAt");
    const [order, setOrder] = useState("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => {
        let active = true;
        async function loadTickets() {
            setLoading(true);
            setError(null);
            try {
                const result = await getTickets(requesterId, { search, category, requestedPriority, itPriority, status, sort, order, page, pageSize });
                if (!active)
                    return;
                setRows(result.data);
                setMeta(result.meta);
            }
            catch (requestError) {
                if (active) {
                    setError(requestError instanceof Error ? requestError.message : "Unable to load tickets.");
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
    }, [requesterId, search, category, requestedPriority, itPriority, status, sort, order, page, pageSize]);
    useEffect(() => { void getCategories().then(setCategories).catch(() => undefined); }, []);
    const clearFilters = () => { setSearch(""); setCategory(""); setRequestedPriority(""); setItPriority(""); setStatus(""); setPage(1); };
    const toggleSort = (field) => { setPage(1); if (sort === field)
        setOrder((current) => current === "asc" ? "desc" : "asc");
    else {
        setSort(field);
        setOrder("asc");
    } };
    const sortLabel = (field) => sort === field ? `, sorted ${order === "asc" ? "ascending" : "descending"}` : "";
    if (loading) {
        return _jsx("div", { className: "page-card", children: _jsx("div", { className: "loading-state", role: "status", children: "Loading tickets\u2026" }) });
    }
    return (_jsxs("div", { className: "page-card", children: [_jsxs("div", { className: "ticket-list-header", children: [_jsxs("div", { children: [_jsx("h1", { className: "page-title", children: "My Tickets" }), _jsx("p", { children: "Review and track your submitted tickets." })] }), _jsxs("div", { className: "header-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: clearFilters, children: "Clear Filters" }), _jsx("button", { type: "button", className: "primary-button", onClick: onCreateTicket, children: "Create Ticket" })] })] }), _jsxs("div", { className: "filters-row", children: [_jsx("input", { "aria-label": "Search tickets", className: "input-field", value: search, onChange: (event) => { setSearch(event.target.value); setPage(1); }, placeholder: "Ticket Number or Summary" }), _jsxs("select", { "aria-label": "Category", className: "select-field", value: category, onChange: (event) => { setCategory(event.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All Categories" }), categories.map((item) => _jsx("option", { value: item.id, children: item.name }, item.id))] }), _jsxs("select", { "aria-label": "Requested priority", className: "select-field", value: requestedPriority, onChange: (event) => { setRequestedPriority(event.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All Requested Priorities" }), _jsx("option", { value: "LOW", children: "Low" }), _jsx("option", { value: "MEDIUM", children: "Medium" }), _jsx("option", { value: "HIGH", children: "High" })] }), _jsxs("select", { "aria-label": "IT priority", className: "select-field", value: itPriority, onChange: (event) => { setItPriority(event.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All IT Priorities" }), _jsx("option", { value: "LOW", children: "Low" }), _jsx("option", { value: "MEDIUM", children: "Medium" }), _jsx("option", { value: "HIGH", children: "High" })] }), _jsxs("select", { "aria-label": "Ticket status", className: "select-field", value: status, onChange: (event) => { setStatus(event.target.value); setPage(1); }, children: [_jsx("option", { value: "", children: "All Statuses" }), _jsx("option", { value: "NEW", children: "New" }), _jsx("option", { value: "OPEN", children: "Open" }), _jsx("option", { value: "IN_PROGRESS", children: "In Progress" }), _jsx("option", { value: "RESOLVED", children: "Resolved" }), _jsx("option", { value: "PENDING", children: "Pending" })] })] }), error ? _jsxs("div", { className: "error-panel", role: "alert", children: [error, _jsx("button", { type: "button", className: "secondary-button", onClick: () => setPage((current) => current), children: "Retry" })] }) : meta.isEmpty ? (_jsxs("div", { className: "empty-state", children: [_jsx("div", { "aria-hidden": "true", children: "\u25A1" }), _jsx("p", { children: "You have no tickets yet." }), _jsx("button", { type: "button", className: "primary-button", onClick: onCreateTicket, children: "Create your first ticket" })] })) : meta.isNoResults ? (_jsxs("div", { className: "empty-state", children: [_jsx("p", { children: "No tickets match your filters." }), _jsx("button", { type: "button", className: "secondary-button", onClick: clearFilters, children: "Clear Filters" })] })) : (_jsxs("table", { className: "ticket-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: _jsxs("button", { type: "button", className: "sort-button", "aria-label": `Sort by ticket number${sortLabel("ticketNumber")}`, onClick: () => toggleSort("ticketNumber"), children: ["Ticket No. ", sort === "ticketNumber" && (order === "asc" ? "↑" : "↓")] }) }), _jsx("th", { children: _jsxs("button", { type: "button", className: "sort-button", "aria-label": `Sort by created date${sortLabel("createdAt")}`, onClick: () => toggleSort("createdAt"), children: ["Created Date ", sort === "createdAt" && (order === "asc" ? "↑" : "↓")] }) }), _jsx("th", { children: "Summary" }), _jsx("th", { children: "Category" }), _jsx("th", { children: "Requested Priority" }), _jsx("th", { children: "IT Priority" }), _jsx("th", { children: "Status" }), _jsx("th", { children: _jsxs("button", { type: "button", className: "sort-button", "aria-label": `Sort by last updated${sortLabel("updatedAt")}`, onClick: () => toggleSort("updatedAt"), children: ["Last Updated ", sort === "updatedAt" && (order === "asc" ? "↑" : "↓")] }) })] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("button", { type: "button", className: "link-button", onClick: () => onSelectTicket?.(row.id), children: row.ticketNumber }) }), _jsx("td", { children: formatDate(row.createdAt) }), _jsx("td", { children: row.summary }), _jsx("td", { children: row.category }), _jsx("td", { children: badge(row.requestedPriority) }), _jsx("td", { children: badge(row.itPriority) }), _jsx("td", { children: badge(row.status) }), _jsx("td", { children: formatDate(row.updatedAt ?? row.createdAt) })] }, row.id))) })] })), _jsxs("div", { className: "pagination-row", children: [_jsx("button", { type: "button", className: "secondary-button", disabled: page === 1, onClick: () => setPage((previous) => Math.max(1, previous - 1)), children: "Previous" }), _jsxs("span", { children: ["Showing ", meta.totalItems === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1, " to ", Math.min(meta.page * meta.pageSize, meta.totalItems), " of ", meta.totalItems, " tickets \u00B7 Page ", meta.page, " of ", meta.totalPages] }), _jsx("button", { type: "button", className: "secondary-button", disabled: page >= meta.totalPages, onClick: () => setPage((previous) => Math.min(meta.totalPages, previous + 1)), children: "Next" }), _jsxs("select", { "aria-label": "Page size", className: "select-field select-field--small", value: pageSize, onChange: (event) => setPageSize(Number(event.target.value)), children: [_jsx("option", { value: 10, children: "10" }), _jsx("option", { value: 20, children: "20" }), _jsx("option", { value: 50, children: "50" })] })] })] }));
}
