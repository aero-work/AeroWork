import { useCallback, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { TodoPanel } from "./TodoPanel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { useSessionData } from "@/hooks/useSessionData";
import { agentAPI } from "@/services/api";
import { isDesktopApp } from "@/services/transport";
import { ConnectionSetup } from "@/components/common/ConnectionSetup";
import { cn } from "@/lib/utils";
import { Bot, FolderOpen, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import type { ChatItem, TodoWriteInput, TodoItem } from "@/types/acp";

// Extract the latest TodoWrite todos from chat items
function extractLatestTodos(chatItems: ChatItem[]): TodoItem[] {
  // Find the last TodoWrite tool call
  for (let i = chatItems.length - 1; i >= 0; i--) {
    const item = chatItems[i];
    if (item.type === "tool_call" && item.toolCall.title?.includes("TodoWrite")) {
      const input = item.toolCall.rawInput as TodoWriteInput | undefined;
      if (input?.todos && Array.isArray(input.todos)) {
        return input.todos;
      }
    }
  }
  return [];
}

export function ChatView() {
  const { t } = useTranslation();

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
  const isYoloMode = sessionState?.dangerousMode ?? false;

  // Toggle Yolo mode
  const handleToggleYoloMode = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await agentAPI.setDangerousMode(activeSessionId, !isYoloMode);
    } catch (error) {
      console.error("Failed to toggle Yolo mode:", error);
    }
  }, [activeSessionId, isYoloMode]);

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

  // Handle AskUserQuestion submission
  const [askUserQuestionSubmitting, setAskUserQuestionSubmitting] = useState<string | null>(null);

  const handleAskUserQuestionSubmit = useCallback(
    async (toolCallId: string, answers: Record<string, string | string[]>) => {
      if (!activeSessionId) return;

      setAskUserQuestionSubmitting(toolCallId);

      try {
        // Format answers into a user-friendly message
        const answerLines = Object.entries(answers).map(([header, answer]) => {
          if (Array.isArray(answer)) {
            return `**${header}**: ${answer.join(", ")}`;
          }
          return `**${header}**: ${answer}`;
        });

        const responseContent = answerLines.join("\n");

        // Add optimistic message
        const messageId = addOptimisticMessage(responseContent);

        // Send as a regular prompt
        await agentAPI.sendPrompt(activeSessionId, responseContent, messageId);
      } catch (error) {
        console.error("Failed to submit AskUserQuestion answer:", error);
      } finally {
        setAskUserQuestionSubmitting(null);
      }
    },
    [activeSessionId, addOptimisticMessage]
  );

  // Extract todos from chat items (must be before any conditional returns)
  const todos = useMemo(
    () => extractLatestTodos(sessionState?.chatItems || []),
    [sessionState?.chatItems]
  );
  const hasActiveTodos = todos.length > 0 && todos.some((t) => t.status !== "completed");

  // Empty state when no session
  if (!hasSession) {
    // For web/mobile, show connection setup UI when not connected
    if (!isConnected && !isDesktopApp()) {
      return <ConnectionSetup isConnecting={connectionStatus === "connecting"} />;
    }

    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          {!isConnected ? (
            <>
              <Bot className="w-16 h-16 opacity-20" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Welcome to <span style={{ fontFamily: 'Quantico, sans-serif', fontStyle: 'italic' }}>Aero Work</span>
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
    <div className="flex flex-col h-full relative">
      {/* Yolo mode toggle - floating in top right corner */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isYoloMode ? "default" : "secondary"}
              size="sm"
              onClick={handleToggleYoloMode}
              className={cn(
                "absolute top-2 right-2 z-10 gap-1.5 transition-all",
                isYoloMode
                  ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                  : "bg-background/95 backdrop-blur-sm border shadow-sm hover:bg-muted"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
              <span
                style={{ fontFamily: "Quantico, sans-serif", fontStyle: "italic" }}
                className={cn(!isYoloMode && "line-through opacity-60")}
              >
                {t("session.yoloMode")}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isYoloMode ? t("session.yoloModeClickToDisable") : t("session.yoloModeClickToEnable")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <MessageList
        chatItems={sessionState?.chatItems || []}
        isLoading={isPromptLoading}
        onAskUserQuestionSubmit={handleAskUserQuestionSubmit}
        askUserQuestionSubmitting={askUserQuestionSubmitting}
      />
      {/* Todo panel - sticky above input */}
      {hasActiveTodos && <TodoPanel todos={todos} />}
      <ChatInput
        onSend={handleSend}
        onCancel={handleCancel}
        isLoading={isPromptLoading}
        disabled={!isConnected || !hasSession}
      />
    </div>
  );
}
