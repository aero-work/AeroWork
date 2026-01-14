import { MainLayout } from "@/components/layout/MainLayout";
import { TransportProvider } from "@/services/transport";
import { useAutoConnect } from "@/hooks/useAutoConnect";

function AppContent() {
  // Auto-connect to backend when app loads
  useAutoConnect();

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
