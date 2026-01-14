import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAgentStore, type ConnectionStatus } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { agentAPI } from "@/services/api";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import {
  Plug,
  PlugZap,
  Loader2,
  AlertCircle,
  Bot,
  FolderOpen,
} from "lucide-react";

const statusConfig: Record<
  ConnectionStatus,
  { icon: React.ComponentType<{ className?: string }>; label: string; className: string }
> = {
  disconnected: { icon: Plug, label: "Connect", className: "text-muted-foreground" },
  connecting: { icon: Loader2, label: "Connecting...", className: "text-blue-500 animate-spin" },
  connected: { icon: PlugZap, label: "Disconnect", className: "text-green-500" },
  error: { icon: AlertCircle, label: "Reconnect", className: "text-destructive" },
};

export function Header() {
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const addRecentProject = useFileStore((state) => state.addRecentProject);

  const { icon: StatusIcon, label, className } = statusConfig[connectionStatus];
  const isConnected = connectionStatus === "connected";

  const handleConnect = useCallback(async () => {
    if (connectionStatus === "connecting") return;

    if (isConnected) {
      await agentAPI.disconnect();
    } else {
      try {
        await agentAPI.connect();
      } catch (error) {
        console.error("Failed to connect:", error);
      }
    }
  }, [connectionStatus, isConnected]);

  return (
    <header className="h-12 border-b bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Bot className="w-5 h-5 text-primary" />
        <h1 className="font-semibold">Aero Code</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Project Selector */}
        <ProjectSelector
          onSelect={addRecentProject}
          trigger={
            <Button variant="outline" size="sm" className="gap-2">
              <FolderOpen className="w-4 h-4" />
              {currentWorkingDir ? (
                <span className="max-w-40 truncate">
                  {currentWorkingDir.split("/").pop()}
                </span>
              ) : (
                "Open Project"
              )}
            </Button>
          }
        />

        {/* Connect Button */}
        <Button
          variant={isConnected ? "outline" : "default"}
          size="sm"
          onClick={handleConnect}
          disabled={connectionStatus === "connecting"}
          className="flex items-center gap-2"
        >
          <StatusIcon className={className} />
          {label}
        </Button>
      </div>
    </header>
  );
}
