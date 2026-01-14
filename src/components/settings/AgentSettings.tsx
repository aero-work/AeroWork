import { useAgentStore } from "@/stores/agentStore";
import { Button } from "@/components/ui/button";
import { Bot, Power, PowerOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentAPI } from "@/services/api";

export function AgentSettings() {
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const agentInfo = useAgentStore((state) => state.agentInfo);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "connecting";

  const handleConnect = async () => {
    try {
      await agentAPI.connect();
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await agentAPI.disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Agent Connection</h3>
        <p className="text-sm text-muted-foreground">
          Manage the connection to the AI coding agent.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isConnected ? "bg-green-500/10" : "bg-muted"
            )}>
              <Bot className={cn(
                "w-5 h-5",
                isConnected ? "text-green-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              {agentInfo ? (
                <>
                  <div className="font-medium">{agentInfo.title || agentInfo.name}</div>
                  <div className="text-sm text-muted-foreground">
                    v{agentInfo.version}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium">No Agent Connected</div>
                  <div className="text-sm text-muted-foreground">
                    Click connect to start
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-sm">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-green-500" :
                isConnecting ? "bg-yellow-500 animate-pulse" : "bg-muted-foreground"
              )} />
              <span className="capitalize">{connectionStatus}</span>
            </div>

            {/* Connect/Disconnect button */}
            {isConnected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
              >
                <PowerOff className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Power className="w-4 h-4 mr-2" />
                )}
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Agent Details */}
      {agentInfo && (
        <div className="rounded-lg border p-4 space-y-3">
          <h4 className="font-medium">Agent Details</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Name</span>
              <span>{agentInfo.name}</span>
            </div>
            {agentInfo.title && (
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Title</span>
                <span>{agentInfo.title}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Version</span>
              <span>{agentInfo.version}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Protocol</span>
              <span>ACP v1</span>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          The agent runs as a subprocess and communicates via the Agent Client Protocol (ACP).
          Currently using <code className="bg-muted px-1 rounded">claude-code-acp</code> adapter.
        </p>
      </div>
    </div>
  );
}
