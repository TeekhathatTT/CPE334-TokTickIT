import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function AppShell({ children, activeNav = "my-tickets", selectedRequesterName = "Requester", onNavigate, }) {
    const navItems = [
        { key: "my-tickets", label: "My Tickets" },
        { key: "create-ticket", label: "Create Ticket" },
    ];
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "topbar", role: "banner", children: _jsxs("div", { className: "topbar__inner", children: [_jsx("div", { className: "brand", "aria-label": "TokTickIT home", children: _jsx("span", { className: "brand__mark", children: "TokTickIT" }) }), _jsx("nav", { className: "main-nav", "aria-label": "Main navigation", children: navItems.map((item) => (_jsx("button", { type: "button", className: `nav-tab ${activeNav === item.key ? "active" : ""}`, onClick: () => onNavigate?.(item.key), children: item.label }, item.key))) }), _jsxs("div", { className: "profile-menu", "aria-label": "Selected requester", children: [_jsx("span", { children: selectedRequesterName }), _jsx("span", { "aria-hidden": "true", children: "\u2304" })] })] }) }), _jsx("main", { className: "page-shell", children: children })] }));
}
