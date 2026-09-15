import { useState, type ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  activeNav?: "my-tickets" | "create-ticket" | "staff-queue";
  userName?: string;
  userRole?: string;
  onNavigate?: (view: "my-tickets" | "create-ticket" | "staff-queue") => void;
  onLogout?: () => void;
  navItems?: Array<{ key: "my-tickets" | "create-ticket" | "staff-queue"; label: string }>;
}

export function AppShell({
  children,
  activeNav = "my-tickets",
  userName = "User",
  userRole = "Requester",
  onNavigate,
  onLogout,
  navItems,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const resolvedNavItems = navItems ?? [
    { key: "my-tickets", label: "My Tickets" },
    { key: "create-ticket", label: "Create Ticket" },
  ];

  return (
    <div className="app-shell">
      <header className="topbar" role="banner">
        <div className="topbar__inner">
          <div className="brand" aria-label="TokTickIT home">
            <span className="brand__mark">TokTickIT</span>
          </div>

          <button type="button" className="menu-toggle" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>☰</button>
          <nav className={`main-nav ${menuOpen ? "main-nav--open" : ""}`} aria-label="Main navigation">
            {resolvedNavItems.map((item) => (
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

          <div className={`profile-menu ${menuOpen ? "profile-menu--open" : ""}`} aria-label="Current user">
            <span>{userName} ({userRole})</span>
            <button type="button" className="tertiary-button" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
