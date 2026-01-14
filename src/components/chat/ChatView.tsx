import { useCallback } from "react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { useSessionData } from "@/hooks/useSessionData";
import { agentAPI } from "@/services/api";
import { Bot, FolderOpen, MessageSquare, Loader2 } from "lucide-react";

export function ChatView() {
  // UI state from stores
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const isPromptLoading = useSessionStore((state) => state.isLoading);
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);

  // Session data from server (single source of truth)
  const {
    state: sessionState,
    isLoading: isSessionLoading,
    error: sessionError,
    addOptimisticMessage,
  } = useSessionData(activeSessionId);

  const isConnected = connectionStatus === "connected";
  const hasSession = !!activeSessionId;

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeSessionId) return;

      // Add optimistic message for immediate feedback and get its ID
      const messageId = addOptimisticMessage(content);

      try {
        // Pass messageId to backend so it uses the same ID (for deduplication)
        await agentAPI.sendPrompt(activeSessionId, content, messageId);
      } catch (error) {
        console.error("Failed to send message:", error);
        // TODO: Remove optimistic message on error, or show error state
      }
    },
    [activeSessionId, addOptimisticMessage]
  );

  const handleCancel = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await agentAPI.cancelSession(activeSessionId);
    } catch (error) {
      console.error("Failed to cancel session:", error);
    }
  }, [activeSessionId]);

  // Empty state when no session
  if (!hasSession) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          {!isConnected ? (
            <>
              <Bot className="w-16 h-16 opacity-20" />
              <div>
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Welcome to Aero Code
                </h2>
                <p className="text-sm">
                  Click <strong>Connect</strong> to start the AI agent.
                </p>
              </div>
            </>
          ) : !currentWorkingDir ? (
            <>
              <FolderOpen className="w-16 h-16 opacity-20" />
              <div>
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Select a Project
                </h2>
                <p className="text-sm">
                  Open a project folder from the <strong>Files</strong> section
                  in the sidebar.
                </p>
              </div>
            </>
          ) : (
            <>
              <MessageSquare className="w-16 h-16 opacity-20" />
              <div>
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Start a Session
                </h2>
                <p className="text-sm">
                  Click the <strong>+</strong> button in the{" "}
                  <strong>Sessions</strong> section to create a new
                  conversation.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show loading state while session is being fetched from server
  if (isSessionLoading && !sessionState) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
        <p className="mt-2 text-sm">Loading session...</p>
      </div>
    );
  }

  // Show error state if session fetch failed
  if (sessionError && !sessionState) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <p className="text-sm text-destructive">Error: {sessionError}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList
        chatItems={sessionState?.chatItems || []}
        isLoading={isPromptLoading}
      />
      <ChatInput
        onSend={handleSend}
        onCancel={handleCancel}
        isLoading={isPromptLoading}
        disabled={!isConnected || !hasSession}
      />
    </div>
  );
}
