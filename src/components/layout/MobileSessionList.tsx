import { useCallback, useMemo, useEffect } from "react";
import { SwipeableSessionCard } from "@/components/chat/SwipeableSessionCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { useMobileNavStore } from "@/stores/mobileNavStore";
import { agentAPI } from "@/services/api";
import type { SessionInfo } from "@/types/acp";
import {
  Plus,
  Bot,
  FolderOpen,
  Loader2,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

// Sort sessions: active first, then by lastActivity descending
function sortSessions(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => {
    // Active sessions first
    if (a.active && !b.active) return -1;
    if (!a.active && b.active) return 1;
    // Then by lastActivity descending (newest first)
    const timeA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const timeB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return timeB - timeA;
  });
}

export function MobileSessionList() {
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const availableSessionsLoading = useSessionStore((state) => state.availableSessionsLoading);

  // Sort sessions: active first, then by time descending
  const sortedSessions = useMemo(
    () => sortSessions(availableSessions),
    [availableSessions]
  );
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const isConnected = connectionStatus === "connected";

  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);

  const enterConversation = useMobileNavStore((state) => state.enterConversation);

  // Load sessions when connected and project is selected
  useEffect(() => {
    if (isConnected && currentWorkingDir) {
      agentAPI.listSessions(currentWorkingDir, 50, 0).catch(console.error);
    }
  }, [isConnected, currentWorkingDir]);

  // Create new session
  const handleNewSession = useCallback(async () => {
    if (!isConnected) return;

    try {
      const sessionId = await agentAPI.createSession(currentWorkingDir || undefined);
      setActiveSession(sessionId);
      enterConversation();
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  }, [isConnected, currentWorkingDir, setActiveSession, enterConversation]);

  // Open existing session
  const handleOpenSession = useCallback(
    async (sessionId: string) => {
      setActiveSession(sessionId);
      enterConversation();
    },
    [setActiveSession, enterConversation]
  );

  // Refresh sessions list
  const handleRefresh = useCallback(async () => {
    if (!isConnected) return;
    try {
      await agentAPI.listSessions(currentWorkingDir || undefined, 50, 0);
    } catch (error) {
      console.error("Failed to refresh sessions:", error);
    }
  }, [isConnected, currentWorkingDir]);

  // Delete session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await agentAPI.deleteSession(sessionId);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  }, []);

  // Stop active session (disconnect from ACP agent)
  const handleStopSession = useCallback(async () => {
    try {
      await agentAPI.disconnect();
      // Clear active session after disconnect
      setActiveSession(null);
    } catch (error) {
      console.error("Failed to stop session:", error);
    }
  }, [setActiveSession]);

  // Not connected state
  if (!isConnected) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground px-6">
        <Bot className="w-16 h-16 opacity-20 mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">
          Welcome to Aero Code
        </h2>
        <p className="text-sm text-center mb-4">
          Connecting to the AI agent...
        </p>
        <p className="text-xs text-center text-muted-foreground">
          Check <strong>Settings</strong> if connection fails.
        </p>
      </div>
    );
  }

  // No project selected
  if (!currentWorkingDir) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground px-6">
        <FolderOpen className="w-16 h-16 opacity-20 mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">
          Select a Project
        </h2>
        <p className="text-sm text-center">
          Tap the <strong>Open</strong> button in the header to select a project folder.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* New Conversation Button */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={handleNewSession}
          className="w-full h-12 text-base"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Conversation
        </Button>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        {availableSessionsLoading && sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Loading sessions...</p>
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-6">
            <MessageSquare className="w-12 h-12 opacity-20 mb-4" />
            <h3 className="text-base font-medium text-foreground mb-2">
              No Conversations Yet
            </h3>
            <p className="text-sm text-center">
              Tap the button above to start your first conversation.
            </p>
          </div>
        ) : (
          <div>
            {sortedSessions.map((session) => (
              <SwipeableSessionCard
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => handleOpenSession(session.id)}
                onDelete={() => handleDeleteSession(session.id)}
                onStop={handleStopSession}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Refresh button (floating) */}
      {availableSessions.length > 0 && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-20 right-4 h-10 w-10 rounded-full shadow-lg bg-background"
          onClick={handleRefresh}
          disabled={availableSessionsLoading}
        >
          <RefreshCw className={`w-4 h-4 ${availableSessionsLoading ? "animate-spin" : ""}`} />
        </Button>
      )}
    </div>
  );
}
