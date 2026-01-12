import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { ChatView } from "@/components/chat";
import { EditorPanel } from "@/components/editor";
import { PermissionDialog } from "@/components/common/PermissionDialog";
import { ThreePanelLayout } from "@/components/ui/resizable";
import { useFileStore } from "@/stores/fileStore";

export function MainLayout() {
  const hasOpenFiles = useFileStore((state) => state.openFiles.length > 0);

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        {hasOpenFiles ? (
          <ThreePanelLayout
            sidebar={<Sidebar />}
            center={<ChatView />}
            right={<EditorPanel />}
            sidebarDefaultSize={240}
            sidebarMinSize={180}
            sidebarMaxSize={400}
            rightDefaultSize={500}
            rightMinSize={300}
            rightMaxSize={900}
          />
        ) : (
          <div className="flex h-full">
            {/* Two-panel layout when no files open */}
            <div className="w-60 border-r flex-shrink-0">
              <Sidebar />
            </div>
            <div className="flex-1 min-w-0">
              <ChatView />
            </div>
          </div>
        )}
      </main>
      <StatusBar />
      <PermissionDialog />
    </div>
  );
}
