import { useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { RequesterSelectionPage } from "./pages/RequesterSelectionPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import CreateTicketPage from "./pages/CreateTicketPage";
import TicketDetailPage from "./pages/TicketDetailPage";

export default function App() {
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<"my-tickets" | "create-ticket">("my-tickets");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const selectedRequesterName = useMemo(() => {
    if (!selectedRequesterId) {
      return "Requester";
    }

    return `Requester ${selectedRequesterId}`;
  }, [selectedRequesterId]);

  const page = selectedRequesterId ? (
    selectedTicketId ? <TicketDetailPage ticketId={selectedTicketId} requesterId={selectedRequesterId} onBack={() => setSelectedTicketId(null)} /> : currentView === "create-ticket" ? <CreateTicketPage requesterId={selectedRequesterId} /> : <MyTicketsPage requesterId={selectedRequesterId} onCreateTicket={() => setCurrentView("create-ticket")} onSelectTicket={setSelectedTicketId} />
  ) : (
    <RequesterSelectionPage
      selectedRequesterId={selectedRequesterId}
      onRequesterChange={() => undefined}
      onContinue={(requesterId) => setSelectedRequesterId(requesterId)}
    />
  );

  return (
    <AppShell
      activeNav={currentView}
      selectedRequesterName={selectedRequesterName}
      onNavigate={(view) => { setSelectedTicketId(null); setCurrentView(view); }}
      onChangeRequester={() => { setSelectedTicketId(null); setSelectedRequesterId(null); }}
    >
      {page}
    </AppShell>
  );
}
