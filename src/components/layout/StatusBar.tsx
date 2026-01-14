import { useAgentStore } from "@/stores/agentStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useFileStore } from "@/stores/fileStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { getWebSocketEndpoint } from "@/services/transport";
import { cn } from "@/lib/utils";
import { Circle, FolderOpen, MessageSquare, Terminal, Server, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatusBar() {
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const agentInfo = useAgentStore((state) => state.agentInfo);
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const isLoading = useSessionStore((state) => state.isLoading);
  const terminals = useTerminalStore((state) => state.terminals);
  const isTerminalPanelOpen = useTerminalStore((state) => state.isTerminalPanelOpen);
  const toggleTerminalPanel = useTerminalStore((state) => state.toggleTerminalPanel);
  const createTerminal = useTerminalStore((state) => state.createTerminal);
  const setTerminalPanelOpen = useTerminalStore((state) => state.setTerminalPanelOpen);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const sessionCount = availableSessions.filter((s) => s.active).length;
  const isConnected = connectionStatus === "connected";
  const endpointUrl = getWebSocketEndpoint();

  // Truncate session ID for display (show first 8 chars)
  const shortSessionId = activeSessionId ? activeSessionId.substring(0, 8) : null;

  const handleTerminalClick = async () => {
    if (terminals.length === 0) {
      // Create a new terminal if none exist
      const workingDir = currentWorkingDir || "/";
      await createTerminal(workingDir, 80, 24);
    } else {
      toggleTerminalPanel();
    }
    if (!isTerminalPanelOpen) {
      setTerminalPanelOpen(true);
    }
  };

  return (
    <footer className="h-6 border-t bg-muted/50 flex items-center justify-between px-3 text-xs">
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          <Circle
            className={cn(
              "w-2 h-2 fill-current",
              isConnected ? "text-green-500" : "text-muted-foreground"
            )}
          />
          <span className="text-muted-foreground">
            {isConnected
              ? agentInfo?.title || agentInfo?.name || "Connected"
              : "Disconnected"}
          </span>
        </div>

        {/* Backend Endpoint */}
        {endpointUrl && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Server className="w-3 h-3" />
            <span className="max-w-48 truncate" title={endpointUrl}>
              {endpointUrl.replace(/^wss?:\/\//, "")}
            </span>
          </div>
        )}

        {/* Active Session ID */}
        {shortSessionId && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Hash className="w-3 h-3" />
            <span
              className="font-mono cursor-pointer hover:text-foreground"
              title={`Session: ${activeSessionId}`}
              onClick={() => {
                navigator.clipboard.writeText(activeSessionId || "");
                console.log("Copied session ID:", activeSessionId);
              }}
            >
              {shortSessionId}
            </span>
          </div>
        )}

        {/* Working Directory */}
        {currentWorkingDir && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FolderOpen className="w-3 h-3" />
            <span className="max-w-48 truncate">{currentWorkingDir}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Loading indicator */}
        {isLoading && (
          <span className="text-muted-foreground animate-pulse">
            Processing...
          </span>
        )}

        {/* Terminal toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-5 px-2 text-xs gap-1",
            isTerminalPanelOpen && "bg-accent"
          )}
          onClick={handleTerminalClick}
        >
          <Terminal className="w-3 h-3" />
          <span>Terminal</span>
          {terminals.length > 0 && (
            <span className="text-muted-foreground">({terminals.length})</span>
          )}
        </Button>

        {/* Session Count */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquare className="w-3 h-3" />
          <span>
            {sessionCount} session{sessionCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </footer>
  );
}
