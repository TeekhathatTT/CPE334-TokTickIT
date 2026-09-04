import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
export function AppShell({ children, activeNav = "my-tickets", selectedRequesterName = "Requester", onNavigate, onChangeRequester, }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const navItems = [
        { key: "my-tickets", label: "My Tickets" },
        { key: "create-ticket", label: "Create Ticket" },
    ];
    return (_jsxs("div", { className: "app-shell", children: [_jsx("header", { className: "topbar", role: "banner", children: _jsxs("div", { className: "topbar__inner", children: [_jsx("div", { className: "brand", "aria-label": "TokTickIT home", children: _jsx("span", { className: "brand__mark", children: "TokTickIT" }) }), _jsx("button", { type: "button", className: "menu-toggle", "aria-label": "Open navigation menu", "aria-expanded": menuOpen, onClick: () => setMenuOpen((current) => !current), children: "\u2630" }), _jsx("nav", { className: `main-nav ${menuOpen ? "main-nav--open" : ""}`, "aria-label": "Main navigation", children: navItems.map((item) => (_jsx("button", { type: "button", className: `nav-tab ${activeNav === item.key ? "active" : ""}`, onClick: () => { onNavigate?.(item.key); setMenuOpen(false); }, children: item.label }, item.key))) }), _jsxs("div", { className: `profile-menu ${menuOpen ? "profile-menu--open" : ""}`, "aria-label": "Selected requester", children: [_jsx("span", { children: selectedRequesterName }), _jsx("span", { "aria-hidden": "true", children: "\u2304" }), _jsx("button", { type: "button", className: "tertiary-button", onClick: onChangeRequester, children: "Change Requester" })] })] }) }), _jsx("main", { className: "page-shell", children: children })] }));
}
