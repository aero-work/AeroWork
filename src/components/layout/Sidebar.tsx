import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { FileTree } from "@/components/editor/FileTree";
import {
  MessageSquare,
  FolderTree,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  History,
  RefreshCw,
  GitFork,
  Loader2,
  Square,
  Clock,
} from "lucide-react";
import { agentAPI } from "@/services/api";
import type { SessionInfo, SessionStatus } from "@/types/acp";

/** Format relative time */
function formatRelativeTime(timestamp: string | number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  if (diffDays === 1) return t("time.yesterday");
  if (diffDays < 7) return t("time.daysAgo", { count: diffDays });

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Get status badge styles */
function getStatusBadgeStyles(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    case "pending":
      return "bg-orange-500/20 text-orange-600 dark:text-orange-400";
    case "idle":
      return "bg-green-500/20 text-green-600 dark:text-green-400";
    case "stopped":
    default:
      return "bg-gray-500/20 text-gray-600 dark:text-gray-400";
  }
}

/** Get status label key */
function getStatusLabelKey(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "session.status.running";
    case "pending":
      return "session.status.pending";
    case "idle":
      return "session.status.ready";
    case "stopped":
    default:
      return "session.status.stopped";
  }
}

type SidebarSection = "sessions" | "files";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  action,
}: CollapsibleSectionProps) {
  return (
    <div className={cn(
      "border-b border-border flex flex-col",
      isOpen && "flex-1 min-h-0"
    )}>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50 flex-shrink-0"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {isOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {icon}
          {title}
        </div>
        {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
      </div>
      {isOpen && (
        <div className="flex-1 min-h-0 overflow-y-auto pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingsButton() {
  const { t } = useTranslation();
  const openSettings = useSettingsStore((state) => state.openSettings);
  const isSettingsOpen = useSettingsStore((state) => state.isOpen);

  return (
    <button
      onClick={() => openSettings("general")}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
        isSettingsOpen
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <Settings className="w-4 h-4" />
      <span>{t("tabs.settings")}</span>
    </button>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Set<SidebarSection>>(
    new Set(["sessions", "files"])
  );
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);
  const [stoppingSessionId, setStoppingSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const availableSessionsLoading = useSessionStore((state) => state.availableSessionsLoading);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);

  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const showChat = useFileStore((state) => state.showChat);
  const closeSettings = useSettingsStore((state) => state.closeSettings);
  const showHiddenFiles = useSettingsStore((state) => state.showHiddenFiles);
  const setShowHiddenFiles = useSettingsStore((state) => state.setShowHiddenFiles);

  const isConnected = connectionStatus === "connected";

  // Load available sessions when connected and working directory changes
  useEffect(() => {
    if (isConnected) {
      agentAPI.listSessions(currentWorkingDir || undefined, 20, 0).catch(console.error);
    }
  }, [isConnected, currentWorkingDir]);

  const toggleSection = (section: SidebarSection) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleNewSession = useCallback(async () => {
    if (!currentWorkingDir || isCreatingSession) return;
    setIsCreatingSession(true);
    closeSettings();
    showChat();
    try {
      const sessionId = await agentAPI.createSession(currentWorkingDir);
      // Set the new session as active
      setActiveSession(sessionId);
      // Refresh sessions list
      await agentAPI.listSessions(currentWorkingDir, 20, 0);
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setIsCreatingSession(false);
    }
  }, [currentWorkingDir, isCreatingSession, closeSettings, showChat, setActiveSession]);

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string
  ) => {
    e.stopPropagation();
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      await agentAPI.deleteSession(sessionId);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const handleResumeSession = async (sessionInfo: SessionInfo) => {
    if (!currentWorkingDir) return;
    closeSettings();
    showChat();
    setResumingSessionId(sessionInfo.id);
    try {
      await agentAPI.resumeSession(sessionInfo.id, sessionInfo.cwd || currentWorkingDir);
      // Refresh sessions list to show the session as active
      await agentAPI.listSessions(currentWorkingDir, 20, 0);
    } catch (error) {
      console.error("Failed to resume session:", error);
    } finally {
      setResumingSessionId(null);
    }
  };

  const handleForkSession = async (e: React.MouseEvent, sessionInfo: SessionInfo) => {
    e.stopPropagation();
    if (!currentWorkingDir) return;
    showChat();
    setResumingSessionId(sessionInfo.id);
    try {
      await agentAPI.forkSession(sessionInfo.id, sessionInfo.cwd || currentWorkingDir);
      // Refresh sessions list to show the forked session as active
      await agentAPI.listSessions(currentWorkingDir, 20, 0);
    } catch (error) {
      console.error("Failed to fork session:", error);
    } finally {
      setResumingSessionId(null);
    }
  };

  const handleRefreshSessions = async () => {
    if (!isConnected) return;
    await agentAPI.listSessions(currentWorkingDir || undefined, 20, 0);
  };

  const handleStopSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setStoppingSessionId(sessionId);
    try {
      await agentAPI.stopSession(sessionId);
    } catch (error) {
      console.error("Failed to stop session:", error);
    } finally {
      setStoppingSessionId(null);
    }
  };

  // Split sessions into active and historical
  const activeSessions = availableSessions.filter((s) => s.active);
  const historicalSessions = availableSessions.filter((s) => !s.active);

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border overflow-hidden">
        {/* Sessions Section */}
        <CollapsibleSection
          title={t("sidebar.sessions")}
          icon={<MessageSquare className="w-4 h-4" />}
          isOpen={openSections.has("sessions")}
          onToggle={() => toggleSection("sessions")}
          action={
            isConnected && currentWorkingDir ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleRefreshSessions}
                  disabled={availableSessionsLoading}
                  title="Refresh sessions"
                >
                  {availableSessionsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleNewSession}
                  disabled={isCreatingSession}
                  title="New session"
                >
                  {isCreatingSession ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                </Button>
              </div>
            ) : null
          }
        >
          <div className="px-2 space-y-1">
            {activeSessions.length === 0 && historicalSessions.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                {isConnected
                  ? currentWorkingDir
                    ? t("sidebar.noSessions")
                    : t("sidebar.selectProjectFirst")
                  : t("sidebar.connectToStart")}
              </div>
            ) : (
              <>
                {/* Active Sessions */}
                {activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex flex-col px-2 py-2 rounded-md cursor-pointer group",
                      activeSessionId === session.id
                        ? "bg-primary/15 border-l-2 border-l-primary"
                        : "hover:bg-accent/50"
                    )}
                    onClick={() => { setActiveSession(session.id); closeSettings(); showChat(); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MessageSquare className="w-3 h-3 flex-shrink-0" />
                        <span className="text-sm truncate">{session.lastUserMessage || session.summary || t("session.conversation")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {stoppingSessionId === session.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100"
                            onClick={(e) => handleStopSession(e, session.id)}
                            title={t("chat.stop")}
                          >
                            <Square className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Status + Time + Message count row */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground pl-5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full font-medium",
                          getStatusBadgeStyles(session.status)
                        )}
                      >
                        {t(getStatusLabelKey(session.status))}
                      </span>
                      {session.lastActivity && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(session.lastActivity, t)}
                        </span>
                      )}
                      {session.messageCount > 0 && (
                        <span>{t("session.messages", { count: session.messageCount })}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Historical Sessions */}
                {historicalSessions.map((sessionInfo) => (
                  <div
                    key={sessionInfo.id}
                    className={cn(
                      "flex flex-col px-2 py-2 rounded-md cursor-pointer group hover:bg-accent/50",
                      resumingSessionId === sessionInfo.id && "opacity-50"
                    )}
                    onClick={() => handleResumeSession(sessionInfo)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <History className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">
                          {sessionInfo.lastUserMessage || sessionInfo.summary || t("session.conversation")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        {resumingSessionId === sessionInfo.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => handleForkSession(e, sessionInfo)}
                              title="Fork session"
                            >
                              <GitFork className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => handleDeleteSession(e, sessionInfo.id)}
                              title={t("common.delete")}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Time + Message count row */}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground pl-5">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded-full font-medium",
                          getStatusBadgeStyles(sessionInfo.status)
                        )}
                      >
                        {t(getStatusLabelKey(sessionInfo.status))}
                      </span>
                      {sessionInfo.lastActivity && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(sessionInfo.lastActivity, t)}
                        </span>
                      )}
                      {sessionInfo.messageCount > 0 && (
                        <span>{t("session.messages", { count: sessionInfo.messageCount })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Files Section */}
        <CollapsibleSection
          title={t("tabs.files")}
          icon={<FolderTree className="w-4 h-4" />}
          isOpen={openSections.has("files")}
          onToggle={() => toggleSection("files")}
          action={
            currentWorkingDir ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
              >
                {showHiddenFiles ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
              </Button>
            ) : null
          }
        >
          <div>
            {/* File tree */}
            {currentWorkingDir ? (
              <FileTree />
            ) : (
              <div className="px-4 py-4 text-xs text-muted-foreground text-center">
                {t("files.selectProject")}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Settings Button - fixed at bottom */}
        <div className="border-t">
          <SettingsButton />
        </div>
    </div>
  );
}
