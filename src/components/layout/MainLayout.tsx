import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { MobileLayout } from "./MobileLayout";
import { ChatView } from "@/components/chat";
import { EditorPanel } from "@/components/editor";
import { TerminalPanel } from "@/components/terminal";
import { PermissionDialog } from "@/components/common/PermissionDialog";
import { SettingsPage } from "@/components/settings";
import { useFileStore } from "@/stores/fileStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export function MainLayout() {
  const isMobile = useIsMobile();

  // Render mobile layout for small screens
  if (isMobile) {
    return <MobileLayout />;
  }

  // Desktop layout
  return <DesktopLayout />;
}

function DesktopLayout() {
  const mainViewMode = useFileStore((state) => state.mainViewMode);
  const hasOpenFiles = useFileStore((state) => state.openFiles.length > 0);
  const isTerminalPanelOpen = useTerminalStore((state) => state.isTerminalPanelOpen);
  const isSettingsOpen = useSettingsStore((state) => state.isOpen);

  // Render the main content area (ChatView, SettingsPage, or EditorPanel)
  const renderMainContent = () => {
    if (isSettingsOpen) {
      return <SettingsPage />;
    }
    if (mainViewMode === "editor" && hasOpenFiles) {
      return <EditorPanel />;
    }
    return <ChatView />;
  };

  // Horizontal content (sidebar + main content)
  // Always render to preserve resize state across terminal toggle
  const horizontalContent = (
    <ResizablePanelGroup direction="horizontal" className="h-full" id="main-horizontal">
      <ResizablePanel id="sidebar" defaultSize="18%" minSize="2%" maxSize="90%">
        <div className="h-full border-r overflow-hidden">
          <Sidebar />
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel id="content" defaultSize="82%" minSize="5%">
        <div className="h-full overflow-hidden">
          {renderMainContent()}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        {isTerminalPanelOpen ? (
          <ResizablePanelGroup direction="vertical" className="h-full" id="main-vertical">
            <ResizablePanel id="main-area" defaultSize="70%" minSize="5%">
              {horizontalContent}
            </ResizablePanel>
            <ResizableHandle orientation="vertical" />
            <ResizablePanel id="terminal" defaultSize="30%" minSize="3%" maxSize="95%">
              <TerminalPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          horizontalContent
        )}
      </main>
      <StatusBar />
      <PermissionDialog />
    </div>
  );
}
