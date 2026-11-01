import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell, type RequesterNavKey, type StaffNavKey } from "./components/AppShell";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import { TicketQueuePage } from "./pages/staff/TicketQueuePage";
import RequesterDashboardPage from "./pages/RequesterDashboardPage";
import StaffDashboardPage from "./pages/staff/StaffDashboardPage";
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
  const [currentView, setCurrentView] = useState<StaffNavKey>("ticket-queue");
  const [queueFilters, setQueueFilters] = useState<Record<string, string | string[]> | undefined>(undefined);

  if (!user) return null;

  return (
    <AppShell
      user={user}
      activeNav={currentView}
      onNavigate={(view) => {
        setSelectedTicketId(null);
        if (view === "dashboard" || view === "ticket-queue") {
          setQueueFilters(undefined);
          setCurrentView(view);
        }
      }}
      onLogout={() => void logout()}
    >
      {selectedTicketId ? (
        <StaffTicketDetailPage
          ticketId={selectedTicketId}
          currentUserId={userId}
          onBack={() => setSelectedTicketId(null)}
        />
      ) : currentView === "dashboard" ? (
        <StaffDashboardPage
          userRole={user.role}
          onNavigateQueue={(filters) => {
            const resolved =
              filters?.ownerId === "me"
                ? { ...filters, ownerId: String(userId) }
                : filters;
            setQueueFilters(resolved);
            setCurrentView("ticket-queue");
          }}
        />
      ) : (
        <TicketQueuePage
          onSelectTicket={setSelectedTicketId}
          initialFilters={queueFilters}
          currentUserId={userId}
        />
      )}
    </AppShell>
  );
}

function RequesterViews() {
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<RequesterNavKey>("my-tickets");
  const [myTicketsFilters, setMyTicketsFilters] = useState<Record<string, string | string[]> | undefined>(undefined);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  if (!user) return null;

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
        if (view === "dashboard" || view === "my-tickets" || view === "create-ticket") {
          setMyTicketsFilters(undefined);
          setCurrentView(view);
        }
      }}
      onLogout={() => void logout()}
    >
      {selectedTicketId ? (
        <TicketDetailPage ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      ) : currentView === "create-ticket" ? (
        <CreateTicketPage
          onCancel={() => setCurrentView("my-tickets")}
          onViewTicket={(ticketId) => {
            setSelectedTicketId(ticketId);
            setCurrentView("my-tickets");
          }}
        />
      ) : currentView === "dashboard" ? (
        <RequesterDashboardPage
          onNavigateMyTickets={(filters) => {
            setMyTicketsFilters(filters);
            setCurrentView("my-tickets");
          }}
          onCreateTicket={() => setCurrentView("create-ticket")}
          onSelectTicket={setSelectedTicketId}
        />
      ) : (
        <MyTicketsPage
          onCreateTicket={() => setCurrentView("create-ticket")}
          onSelectTicket={setSelectedTicketId}
          initialFilters={myTicketsFilters}
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
