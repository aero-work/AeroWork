import { MainLayout } from "@/components/layout/MainLayout";
import { TransportProvider } from "@/services/transport";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useZoom } from "@/hooks/useZoom";

function AppContent() {
  // Auto-connect to backend when app loads
  useAutoConnect();

  // Enable Cmd+/Cmd- zoom shortcuts
  useZoom();

  return <MainLayout />;
}

function App() {
  return (
    <TransportProvider>
      <AppContent />
    </TransportProvider>
  );
}

export default App;
