import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell, type RequesterNavKey } from "./components/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";

function RequesterViews() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<RequesterNavKey>("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  if (!user) return null;

  // Staff/Admin shells ship in their own branches; this branch keeps a safe,
  // explicit placeholder instead of leaking Requester screens to them.
  if (user.role !== "REQUESTER") {
    return (
      <AppShell user={user} activeNav="my-tickets" onLogout={() => void logout()}>
        <div className="page-card">
          <h1 className="page-title">Signed in as {user.name}</h1>
          <p>
            The {user.role === "IT_STAFF" ? "IT Staff Ticket Queue" : "Administrator User Management"} screen
            is delivered by its own Lab 3 branch and is not part of this change.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      activeNav={currentView}
      onNavigate={(view) => { setSelectedTicketId(null); setCurrentView(view); }}
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
