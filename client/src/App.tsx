import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell, type RequesterNavKey } from "./components/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import { TicketQueuePage } from "./pages/staff/TicketQueuePage";
import { StaffTicketDetailPage } from "./pages/staff/StaffTicketDetailPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";

function AdminViews() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <AppShell user={user} activeNav="user-management" onLogout={() => void logout()}>
      <UserManagementPage />
    </AppShell>
  );
}

function StaffViews({ userId }: { userId: number }) {
  const { user, logout } = useAuth();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  if (!user) return null;

  return (
    <AppShell
      user={user}
      activeNav="ticket-queue"
      onNavigate={() => setSelectedTicketId(null)}
      onLogout={() => void logout()}
    >
      {selectedTicketId ? (
        <StaffTicketDetailPage
          ticketId={selectedTicketId}
          currentUserId={userId}
          onBack={() => setSelectedTicketId(null)}
        />
      ) : (
        <TicketQueuePage onSelectTicket={setSelectedTicketId} />
      )}
    </AppShell>
  );
}

function RequesterViews() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<RequesterNavKey>("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  if (!user) return null;

  // IT Staff shell (staff-workflow). Administrator shell is the minimalist
  // User Management screen (ui-spec.md §7) — Requester/Staff screens never
  // leak to it.
  if (user.role === "IT_STAFF") {
    return <StaffViews userId={user.id} />;
  }

  if (user.role === "ADMINISTRATOR") {
    return <AdminViews />;
  }

  if (user.role !== "REQUESTER") {
    return (
      <AppShell user={user} activeNav="my-tickets" onLogout={() => void logout()}>
        <div className="page-card">
          <h1 className="page-title">Signed in as {user.name}</h1>
          <p>Your role is not recognised.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      activeNav={currentView}
      onNavigate={(view) => {
        setSelectedTicketId(null);
        if (view === "my-tickets" || view === "create-ticket") setCurrentView(view);
      }}
      onLogout={() => void logout()}
    >
      {selectedTicketId ? (
        <TicketDetailPage ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      ) : currentView === "create-ticket" ? (
        <CreateTicketPage
          onCancel={() => setCurrentView("my-tickets")}
          onViewTicket={(ticketId) => { setSelectedTicketId(ticketId); setCurrentView("my-tickets"); }}
        />
      ) : (
        <MyTicketsPage
          onCreateTicket={() => setCurrentView("create-ticket")}
          onSelectTicket={setSelectedTicketId}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <RequesterViews />
      </ProtectedRoute>
    </AuthProvider>
  );
}
