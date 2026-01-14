import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ChatView } from "@/components/chat";
import { EditorPanel } from "@/components/editor";
import { TerminalPanel } from "@/components/terminal";
import { PermissionDialog } from "@/components/common/PermissionDialog";
import { SettingsPage } from "@/components/settings";
import { useFileStore } from "@/stores/fileStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export function MainLayout() {
  const hasOpenFiles = useFileStore((state) => state.openFiles.length > 0);
  const isTerminalPanelOpen = useTerminalStore((state) => state.isTerminalPanelOpen);
  const isSettingsOpen = useSettingsStore((state) => state.isOpen);

  // Render the main content area (either ChatView or SettingsPage)
  const renderMainContent = () => {
    if (isSettingsOpen) {
      return <SettingsPage />;
    }
    return <ChatView />;
  };

  // Main horizontal content (sidebar + main content + optional editor)
  const renderHorizontalContent = () => {
    if (hasOpenFiles && !isSettingsOpen) {
      // Three-panel layout: sidebar | chat | editor (only when not in settings)
      return (
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Sidebar */}
          <ResizablePanel defaultSize="18%" minSize="2%" maxSize="80%">
            <div className="h-full border-r overflow-hidden">
              <Sidebar />
            </div>
          </ResizablePanel>
          <ResizableHandle />

          {/* Center (chat or settings) */}
          <ResizablePanel defaultSize="42%" minSize="5%">
            <div className="h-full border-r overflow-hidden">
              {renderMainContent()}
            </div>
          </ResizablePanel>
          <ResizableHandle />

          {/* Right panel (editor) */}
          <ResizablePanel defaultSize="40%" minSize="5%">
            <div className="h-full overflow-hidden">
              <EditorPanel />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }

    // Two-panel layout: sidebar | main content
    return (
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize="18%" minSize="2%" maxSize="90%">
          <div className="h-full border-r overflow-hidden">
            <Sidebar />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="82%" minSize="5%">
          <div className="h-full overflow-hidden">
            {renderMainContent()}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        {isTerminalPanelOpen ? (
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize="70%" minSize="5%">
              {renderHorizontalContent()}
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize="30%" minSize="3%" maxSize="95%">
              <TerminalPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          renderHorizontalContent()
        )}
      </main>
      <StatusBar />
      <PermissionDialog />
    </div>
  );
}
