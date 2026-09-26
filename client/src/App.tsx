import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell, type RequesterNavKey } from "./components/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import { TicketQueuePage } from "./pages/staff/TicketQueuePage";
import { StaffTicketDetailPage } from "./pages/staff/StaffTicketDetailPage";

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

  // IT Staff shell (staff-workflow branch). The admin shell ships in its
  // own branch; anything else keeps the explicit placeholder below.
  if (user.role === "IT_STAFF") {
    return <StaffViews userId={user.id} />;
  }

  // Admin shell ships in its own branch; anything else keeps the explicit
  // placeholder instead of leaking Requester screens to it.
  if (user.role !== "REQUESTER") {
    return (
      <AppShell user={user} activeNav="my-tickets" onLogout={() => void logout()}>
        <div className="page-card">
          <h1 className="page-title">Signed in as {user.name}</h1>
          <p>
            The Administrator User Management screen is delivered by its own
            Lab 3 branch and is not part of this change.
          </p>
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
