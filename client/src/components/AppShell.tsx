import { useState, type ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  activeNav?: "my-tickets" | "create-ticket";
  selectedRequesterName?: string;
  onNavigate?: (view: "my-tickets" | "create-ticket") => void;
  onChangeRequester?: () => void;
}

export function AppShell({
  children,
  activeNav = "my-tickets",
  selectedRequesterName = "Requester",
  onNavigate,
  onChangeRequester,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems: Array<{ key: "my-tickets" | "create-ticket"; label: string }> = [
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
            {navItems.map((item) => (
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

          <div className={`profile-menu ${menuOpen ? "profile-menu--open" : ""}`} aria-label="Selected requester">
            <span>{selectedRequesterName}</span>
            <span aria-hidden="true">⌄</span>
            <button type="button" className="tertiary-button" onClick={onChangeRequester}>Change Requester</button>
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
