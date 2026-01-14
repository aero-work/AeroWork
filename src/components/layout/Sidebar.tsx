import { useState, useEffect } from "react";
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
  Bot,
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
  Server,
  Shield,
  Settings2,
} from "lucide-react";
import { agentAPI } from "@/services/api";
import type { SessionInfo } from "@/types/acp";

type SidebarSection = "sessions" | "files" | "agents" | "settings";

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

function SettingsMenu() {
  const openSettings = useSettingsStore((state) => state.openSettings);

  const menuItems = [
    { id: "general", label: "General", icon: Settings2, description: "App preferences" },
    { id: "models", label: "Models", icon: Bot, description: "AI model config" },
    { id: "mcp", label: "MCP Servers", icon: Server, description: "Protocol servers" },
    { id: "permissions", label: "Permissions", icon: Shield, description: "Tool access rules" },
  ] as const;

  return (
    <div className="px-2 space-y-1">
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => openSettings(item.id)}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent/50 text-left group"
        >
          <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground truncate">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const [openSections, setOpenSections] = useState<Set<SidebarSection>>(
    new Set(["sessions", "files", "agents"])
  );
  const [resumingSessionId, setResumingSessionId] = useState<string | null>(null);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const availableSessions = useSessionStore((state) => state.availableSessions);
  const availableSessionsLoading = useSessionStore((state) => state.availableSessionsLoading);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const agentInfo = useAgentStore((state) => state.agentInfo);

  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const showHiddenFiles = useFileStore((state) => state.showHiddenFiles);
  const toggleHiddenFiles = useFileStore((state) => state.toggleHiddenFiles);

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

  const handleNewSession = async () => {
    if (!currentWorkingDir) return;
    try {
      await agentAPI.createSession(currentWorkingDir);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    _sessionId: string
  ) => {
    e.stopPropagation();
    // TODO: Implement backend session deletion
    console.warn("Session deletion not yet implemented on backend");
  };

  const handleResumeSession = async (sessionInfo: SessionInfo) => {
    if (!currentWorkingDir) return;
    setResumingSessionId(sessionInfo.id);
    try {
      await agentAPI.resumeSession(sessionInfo.id, sessionInfo.cwd || currentWorkingDir);
    } catch (error) {
      console.error("Failed to resume session:", error);
    } finally {
      setResumingSessionId(null);
    }
  };

  const handleForkSession = async (e: React.MouseEvent, sessionInfo: SessionInfo) => {
    e.stopPropagation();
    if (!currentWorkingDir) return;
    setResumingSessionId(sessionInfo.id);
    try {
      await agentAPI.forkSession(sessionInfo.id, sessionInfo.cwd || currentWorkingDir);
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

  // Split sessions into active and historical
  const activeSessions = availableSessions.filter((s) => s.active);
  const historicalSessions = availableSessions.filter((s) => !s.active);

  return (
    <div className="h-full flex flex-col bg-muted/30 overflow-hidden">
        {/* Sessions Section */}
        <CollapsibleSection
          title="Sessions"
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
                  title="New session"
                >
                  <Plus className="w-3 h-3" />
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
                    ? "No sessions yet"
                    : "Select a project first"
                  : "Connect to start"}
              </div>
            ) : (
              <>
                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Active
                    </div>
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group",
                          activeSessionId === session.id
                            ? "bg-accent text-accent-foreground ring-2 ring-primary ring-offset-1 ring-offset-background"
                            : "hover:bg-accent/50"
                        )}
                        onClick={() => setActiveSession(session.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          <span className="text-sm truncate">{session.summary || "Session"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Active indicator - green dot */}
                          <div
                            className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
                            title="Active session"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => handleDeleteSession(e, session.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Historical Sessions */}
                {historicalSessions.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <History className="w-3 h-3" />
                      History
                    </div>
                    {historicalSessions.map((sessionInfo) => (
                      <div
                        key={sessionInfo.id}
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group hover:bg-accent/50",
                          resumingSessionId === sessionInfo.id && "opacity-50"
                        )}
                        onClick={() => handleResumeSession(sessionInfo)}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <History className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate">
                              {sessionInfo.summary || "Session"}
                            </span>
                          </div>
                          {sessionInfo.lastUserMessage && (
                            <span className="text-xs text-muted-foreground truncate pl-5">
                              {sessionInfo.lastUserMessage}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          {resumingSessionId === sessionInfo.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => handleForkSession(e, sessionInfo)}
                                title="Fork session"
                              >
                                <GitFork className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Files Section */}
        <CollapsibleSection
          title="Files"
          icon={<FolderTree className="w-4 h-4" />}
          isOpen={openSections.has("files")}
          onToggle={() => toggleSection("files")}
          action={
            currentWorkingDir ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={toggleHiddenFiles}
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
                Select a project to view files
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Agents Section */}
        <CollapsibleSection
          title="Agents"
          icon={<Bot className="w-4 h-4" />}
          isOpen={openSections.has("agents")}
          onToggle={() => toggleSection("agents")}
        >
          <div className="px-2">
            {agentInfo ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent/50">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isConnected ? "bg-green-500" : "bg-muted-foreground"
                  )}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {agentInfo.title || agentInfo.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    v{agentInfo.version}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                No agent connected
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Settings Section */}
        <CollapsibleSection
          title="Settings"
          icon={<Settings className="w-4 h-4" />}
          isOpen={openSections.has("settings")}
          onToggle={() => toggleSection("settings")}
        >
          <SettingsMenu />
        </CollapsibleSection>
    </div>
  );
}
