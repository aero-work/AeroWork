import { Button } from "@/components/ui/button";
import { useAgentStore, type ConnectionStatus } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import {
  Plug,
  PlugZap,
  Loader2,
  AlertCircle,
  FolderOpen,
} from "lucide-react";

const statusConfig: Record<
  ConnectionStatus,
  { icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  disconnected: { icon: Plug, className: "text-muted-foreground" },
  connecting: { icon: Loader2, className: "text-blue-500 animate-spin" },
  connected: { icon: PlugZap, className: "text-green-500" },
  error: { icon: AlertCircle, className: "text-destructive" },
};

export function Header() {
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const setWorkingDir = useFileStore((state) => state.setWorkingDir);

  const { icon: StatusIcon, className } = statusConfig[connectionStatus];

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
      <h1 className="font-semibold text-lg" style={{ fontFamily: 'Quantico, sans-serif', fontStyle: 'italic' }}>
        Aero Work
      </h1>

      <div className="flex items-center gap-2">
        {/* Project Selector - ProjectSelector handles server sync internally */}
        <ProjectSelector
          onSelect={setWorkingDir}
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

        {/* Connection Status Indicator */}
        <div className="flex items-center gap-1 px-2" title={`Status: ${connectionStatus}`}>
          <StatusIcon className={className} />
        </div>
      </div>
    </header>
  );
}
