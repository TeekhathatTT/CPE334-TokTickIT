import { useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { RequesterSelectionPage } from "./pages/RequesterSelectionPage";

export default function App() {
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<"my-tickets" | "create-ticket">("my-tickets");

  const selectedRequesterName = useMemo(() => {
    if (!selectedRequesterId) {
      return "Requester";
    }

    return `Requester ${selectedRequesterId}`;
  }, [selectedRequesterId]);

  const page = selectedRequesterId ? (
    <div style={{ padding: "32px 0" }}>
      <h2>Requester selected</h2>
      <p>
        The selected requester ID is <strong>{selectedRequesterId}</strong> and will be used for all Lab 2 ticket requests.
      </p>
    </div>
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
      onNavigate={setCurrentView}
    >
      {page}
    </AppShell>
  );
}
