import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  activeNav?: "my-tickets" | "create-ticket";
  selectedRequesterName?: string;
  onNavigate?: (view: "my-tickets" | "create-ticket") => void;
}

export function AppShell({
  children,
  activeNav = "my-tickets",
  selectedRequesterName = "Requester",
  onNavigate,
}: AppShellProps) {
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

          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-tab ${activeNav === item.key ? "active" : ""}`}
                onClick={() => onNavigate?.(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="profile-menu" aria-label="Selected requester">
            <span>{selectedRequesterName}</span>
            <span aria-hidden="true">⌄</span>
          </div>
        </div>
      </header>

      <main className="page-shell">{children}</main>
    </div>
  );
}
