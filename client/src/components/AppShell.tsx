import { useState, type ReactNode } from "react";
import type { CurrentUser } from "../api";

export type RequesterNavKey = "my-tickets" | "create-ticket";
export type StaffNavKey = "ticket-queue";
export type AdminNavKey = "user-management";
export type NavKey = RequesterNavKey | StaffNavKey | AdminNavKey;

interface AppShellProps {
  children: ReactNode;
  user: CurrentUser;
  activeNav?: NavKey;
  onNavigate?: (view: NavKey) => void;
  onLogout?: () => void;
}

function roleBadgeClass(role: CurrentUser["role"]): string {
  if (role === "IT_STAFF") return "badge badge--role-staff";
  if (role === "ADMINISTRATOR") return "badge badge--role-admin";
  return "badge badge--role-requester";
}

function roleLabel(role: CurrentUser["role"]): string {
  if (role === "IT_STAFF") return "IT Staff";
  if (role === "ADMINISTRATOR") return "Administrator";
  return "Requester";
}

export function AppShell({ children, user, activeNav = "my-tickets", onNavigate, onLogout }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Role navigation (ui-spec.md §2): Requester items, the staff-workflow
  // Ticket Queue entry for IT Staff, and User Management for Administrators.
  const navItems: Array<{ key: NavKey; label: string; roles: CurrentUser["role"][] }> = [
    { key: "my-tickets", label: "My Tickets", roles: ["REQUESTER"] },
    { key: "create-ticket", label: "Create Ticket", roles: ["REQUESTER"] },
    { key: "ticket-queue", label: "Ticket Queue", roles: ["IT_STAFF"] },
    { key: "user-management", label: "User Management", roles: ["ADMINISTRATOR"] },
  ];
  const visibleNavItems = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div className="topbar__inner">
          <div className="brand" aria-label="TokTickIT home">
            <span className="brand__mark">TokTickIT</span>
          </div>

          <button type="button" className="menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>☰</button>
          <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Main navigation">
            {visibleNavItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-tab ${activeNav === item.key ? "active" : ""}`}
                onClick={() => { onNavigate?.(item.key); setMenuOpen(false); }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className={`profile-menu ${menuOpen ? "profile-menu--open" : ""}`} aria-label="Signed-in user">
            <span>{user.name}</span>
            <span className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</span>
            <button type="button" className="tertiary-button tertiary-button--light" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
