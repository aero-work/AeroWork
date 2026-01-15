import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMobileNavStore, type MobileView } from "@/stores/mobileNavStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useFileStore } from "@/stores/fileStore";
import { useAgentStore, type ConnectionStatus } from "@/stores/agentStore";
import { MobileProjectSelector } from "@/components/layout/MobileProjectSelector";
import { cn } from "@/lib/utils";
import * as fileService from "@/services/fileService";
import {
  ArrowLeft,
  Save,
  Download,
  FolderOpen,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";

/** Get connection status indicator color */
function getConnectionColor(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-yellow-500";
    case "error":
      return "bg-red-500";
    case "disconnected":
    default:
      return "bg-gray-400";
  }
}

/** Get connection status text (only for non-connected states) */
function getConnectionText(status: ConnectionStatus): string | null {
  switch (status) {
    case "connecting":
      return "Connecting...";
    case "error":
      return "Failed";
    case "disconnected":
      return "Offline";
    case "connected":
    default:
      return null; // No text for connected state
  }
}

// Primary views show "Aero Work", secondary views show dynamic titles
const PRIMARY_VIEWS: MobileView[] = ["session-list", "files", "terminal", "settings"];

export function MobileHeader() {
  const { t } = useTranslation();
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  const currentView = useMobileNavStore((state) => state.currentView);
  const goBack = useMobileNavStore((state) => state.goBack);
  const showBackButton = useMobileNavStore((state) => state.showBackButton);
  const viewingFilePath = useMobileNavStore((state) => state.viewingFilePath);

  const openFiles = useFileStore((state) => state.openFiles);
  const markFileSaved = useFileStore((state) => state.markFileSaved);
  const addRecentProject = useFileStore((state) => state.addRecentProject);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);

  // Get active session info for conversation header
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const dangerousModeSessions = useSessionStore((state) => state.dangerousModeSessions);
  const toggleDangerousMode = useSessionStore((state) => state.toggleDangerousMode);
  const activeSession = availableSessions.find((s) => s.id === activeSessionId);

  // Check if current session is in dangerous mode
  const isDangerousMode = activeSessionId ? dangerousModeSessions.has(activeSessionId) : false;

  // Get current file being viewed
  const currentFile = openFiles.find((f) => f.path === viewingFilePath);

  const handleGoBack = () => {
    goBack();
  };

  // Get title based on current view
  // Primary views (tab bar pages) show "Aero Work"
  // Secondary views show dynamic titles
  const getTitle = (): string => {
    if (PRIMARY_VIEWS.includes(currentView)) {
      return "Aero Work";
    }

    switch (currentView) {
      case "conversation":
        // Show session summary or first user message
        if (activeSession?.lastUserMessage) {
          const msg = activeSession.lastUserMessage;
          return msg.length > 20 ? msg.slice(0, 20) + "..." : msg;
        }
        if (activeSession?.summary && activeSession.summary !== "New Session") {
          const summary = activeSession.summary;
          return summary.length > 20 ? summary.slice(0, 20) + "..." : summary;
        }
        return "Conversation";

      case "file-viewer":
        // Show file name
        if (viewingFilePath) {
          return viewingFilePath.split("/").pop() || "File";
        }
        return "File";

      default:
        return "Aero Work";
    }
  };

  // Save file to backend
  const handleSave = useCallback(async () => {
    if (!currentFile || !currentFile.isDirty) return;
    try {
      await fileService.writeFile(currentFile.path, currentFile.content);
      markFileSaved(currentFile.path);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [currentFile, markFileSaved]);

  // Download file to local machine
  const handleDownload = useCallback(() => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentFile]);

  // Determine which right-side actions to show
  const renderRightActions = () => {
    switch (currentView) {
      case "file-viewer":
        // File actions: Save + Download
        return (
          <>
            {currentFile && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                  disabled={!currentFile.isDirty}
                  className="h-9 w-9"
                  title="Save"
                >
                  <Save className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDownload}
                  className="h-9 w-9"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </Button>
              </>
            )}
          </>
        );

      case "conversation":
        // Dangerous mode indicator + options menu
        return (
          <>
            {/* Dangerous mode indicator */}
            {isDangerousMode && (
              <span className="text-xs font-bold text-red-500 animate-pulse mr-1">
                {t("session.dangerousModeEnabled")}
              </span>
            )}
            {/* Options menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => activeSessionId && toggleDangerousMode(activeSessionId)}
                  className={cn(isDangerousMode && "text-red-500")}
                >
                  <AlertTriangle className={cn("w-4 h-4 mr-2", isDangerousMode && "text-red-500")} />
                  {t("session.dangerousMode")}
                  {isDangerousMode && " ✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        );

      case "session-list":
      case "files":
      case "terminal":
      case "settings":
        // Project selector button - opens full-screen selector on mobile
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 gap-1.5 max-w-[140px]"
            title="Select Project"
            onClick={() => setProjectSelectorOpen(true)}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span className="truncate text-sm">
              {currentWorkingDir ? currentWorkingDir.split("/").pop() : "Open"}
            </span>
          </Button>
        );

      default:
        return null;
    }
  };

  // Handle project selection from mobile selector
  // addRecentProject already sets currentWorkingDir internally
  const handleProjectSelect = useCallback((path: string) => {
    addRecentProject(path);
  }, [addRecentProject]);

  return (
    <>
      <header className="border-b border-border bg-card flex-shrink-0">
        {/* iOS safe area spacer for status bar */}
        <div className="safe-area-top" />
        {/* Header content */}
        <div className="h-12 flex items-center justify-between px-2">
          {/* Left side: Back button or Title */}
          <div className="flex items-center gap-1 min-w-0">
            {showBackButton() && (
              <Button variant="ghost" size="icon" onClick={handleGoBack} className="h-9 w-9 flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}

            {/* Title */}
            <h1
              className="font-semibold text-base truncate pl-2"
              style={
                PRIMARY_VIEWS.includes(currentView)
                  ? { fontFamily: "Quantico, sans-serif", fontStyle: "italic" }
                  : undefined
              }
            >
              {getTitle()}
            </h1>
          </div>

          {/* Right side: Context-specific actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {renderRightActions()}

            {/* Connection status indicator (only on primary views) */}
            {PRIMARY_VIEWS.includes(currentView) && (
              <div className="flex items-center gap-1.5 ml-1">
                {getConnectionText(connectionStatus) && (
                  <span className="text-xs text-muted-foreground">
                    {getConnectionText(connectionStatus)}
                  </span>
                )}
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    getConnectionColor(connectionStatus),
                    connectionStatus === "connecting" && "animate-pulse"
                  )}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Full-screen project selector for mobile */}
      <MobileProjectSelector
        open={projectSelectorOpen}
        onClose={() => setProjectSelectorOpen(false)}
        onSelect={handleProjectSelect}
      />
    </>
  );
}
