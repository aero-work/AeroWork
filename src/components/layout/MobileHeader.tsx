import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useMobileNavStore, type MobileView } from "@/stores/mobileNavStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useFileStore } from "@/stores/fileStore";
import { ProjectSelector } from "@/components/common/ProjectSelector";
import * as fileService from "@/services/fileService";
import {
  Menu,
  ArrowLeft,
  Save,
  Download,
  MoreVertical,
  FolderOpen,
} from "lucide-react";

// Primary views show "Aero Code", secondary views show dynamic titles
const PRIMARY_VIEWS: MobileView[] = ["session-list", "files", "terminal", "settings"];

export function MobileHeader() {
  const currentView = useMobileNavStore((state) => state.currentView);
  const goBack = useMobileNavStore((state) => state.goBack);
  const showBackButton = useMobileNavStore((state) => state.showBackButton);
  const openSidebar = useMobileNavStore((state) => state.openSidebar);
  const viewingFilePath = useMobileNavStore((state) => state.viewingFilePath);

  const openFiles = useFileStore((state) => state.openFiles);
  const markFileSaved = useFileStore((state) => state.markFileSaved);
  const addRecentProject = useFileStore((state) => state.addRecentProject);

  // Get active session info for conversation header
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const activeSession = availableSessions.find((s) => s.id === activeSessionId);

  // Get current file being viewed
  const currentFile = openFiles.find((f) => f.path === viewingFilePath);

  const handleGoBack = () => {
    goBack();
  };

  // Get title based on current view
  // Primary views (tab bar pages) show "Aero Code"
  // Secondary views show dynamic titles
  const getTitle = (): string => {
    if (PRIMARY_VIEWS.includes(currentView)) {
      return "Aero Code";
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
        return "Aero Code";
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
        // Conversation: More menu (for future: mode switch, fork, etc.)
        return (
          <Button variant="ghost" size="icon" className="h-9 w-9" title="Options">
            <MoreVertical className="w-5 h-5" />
          </Button>
        );

      case "session-list":
      case "files":
      case "terminal":
      case "settings":
        // Project selector button
        return (
          <ProjectSelector
            onSelect={addRecentProject}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                title="Select Project"
              >
                <FolderOpen className="w-5 h-5" />
              </Button>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <header className="border-b border-border bg-card flex-shrink-0">
      {/* iOS safe area spacer for status bar */}
      <div className="safe-area-top" />
      {/* Header content */}
      <div className="h-12 flex items-center justify-between px-2">
        {/* Left side: Back button or Hamburger menu */}
        <div className="flex items-center gap-1 min-w-0">
        {showBackButton() ? (
          <Button variant="ghost" size="icon" onClick={handleGoBack} className="h-9 w-9 flex-shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={openSidebar} className="h-9 w-9 flex-shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        )}

        {/* Title */}
        <h1
          className="font-semibold text-base truncate"
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
        <div className="flex items-center gap-1 flex-shrink-0">{renderRightActions()}</div>
      </div>
    </header>
  );
}
