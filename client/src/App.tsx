import { useState } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { AppShell, type NavKey, type RequesterNavKey } from "./components/AppShell";
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
  const [currentView, setCurrentView] = useState<NavKey>("dashboard");
  const [queueFilters, setQueueFilters] = useState<Record<string, string | string[]> | undefined>(undefined);





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


  const [currentView, setCurrentView] = useState<RequesterNavKey>("dashboard");
  const [myTicketsFilters, setMyTicketsFilters] = useState<Record<string, string | string[]> | undefined>(undefined);


  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [queueFilters, setQueueFilters] = useState<Record<string, string | string[]> | undefined>(undefined);





  if (!user) return null;





  // IT Staff shell (staff-workflow). Administrator shell is the minimalist


  // User Management screen (ui-spec.md ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§7) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Requester/Staff screens never


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
















