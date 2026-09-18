import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { getCurrentUser, logout, type AuthUser } from "./api";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [currentView, setCurrentView] = useState<"my-tickets" | "create-ticket" | "staff-queue">("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  useEffect(() => { void getCurrentUser().then((result) => setUser(result.user)).catch(() => undefined).finally(() => setCheckingSession(false)); }, []);
  if (checkingSession) return <div className="page-shell"><div className="loading-state" role="status">Loading…</div></div>;
  if (!user) return <LoginPage onSuccess={setUser} />;
  if (user.mustChangePassword) return <ChangePasswordPage onSuccess={setUser} />;

  if (user.role === "IT_STAFF") {
    return (
      <AppShell
        activeNav={currentView}
        userName={user.name}
        userRole={user.role}
        navItems={[{ key: "staff-queue", label: "Ticket Queue" }]}
        onNavigate={(view) => { setSelectedTicketId(null); setCurrentView(view as "staff-queue"); }}
        onLogout={() => { void logout().finally(() => setUser(null)); }}
      >
        <div className="page-shell">
          <h1>Staff Queue</h1>
          <p className="helper-text">Staff ticket workflow is available.</p>
        </div>
      </AppShell>
    );
  }

  const page = selectedTicketId ? <TicketDetailPage ticketId={selectedTicketId} requesterId={user.id} onBack={() => setSelectedTicketId(null)} /> : currentView === "create-ticket" ? <CreateTicketPage requesterId={user.id} requesterName={user.name} onCancel={() => setCurrentView("my-tickets")} onViewTicket={(ticketId) => { setSelectedTicketId(ticketId); setCurrentView("my-tickets"); }} /> : <MyTicketsPage requesterId={user.id} onCreateTicket={() => setCurrentView("create-ticket")} onSelectTicket={setSelectedTicketId} />;

  return (
    <AppShell
      activeNav={currentView}
      userName={user.name}
      userRole={user.role}
      onNavigate={(view) => { setSelectedTicketId(null); setCurrentView(view); }}
      onLogout={() => { void logout().finally(() => setUser(null)); }}
    >
      {page}
    </AppShell>
  );
}
