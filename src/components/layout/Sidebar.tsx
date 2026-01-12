import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/sessionStore";
import { useAgentStore } from "@/stores/agentStore";
import { useFileStore } from "@/stores/fileStore";
import { ProjectSelector } from "@/components/common/ProjectSelector";
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
} from "lucide-react";
import { agentAPI } from "@/services/api";

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

export function Sidebar() {
  const [openSections, setOpenSections] = useState<Set<SidebarSection>>(
    new Set(["sessions", "files", "agents"])
  );

  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const agentInfo = useAgentStore((state) => state.agentInfo);

  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const addRecentProject = useFileStore((state) => state.addRecentProject);
  const showHiddenFiles = useFileStore((state) => state.showHiddenFiles);
  const toggleHiddenFiles = useFileStore((state) => state.toggleHiddenFiles);

  const isConnected = connectionStatus === "connected";

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
    sessionId: string
  ) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  const sessionList = Object.values(sessions);

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
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleNewSession}
              >
                <Plus className="w-3 h-3" />
              </Button>
            ) : null
          }
        >
          <div className="px-2 space-y-1">
            {sessionList.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted-foreground text-center">
                {isConnected
                  ? currentWorkingDir
                    ? "No sessions yet"
                    : "Select a project first"
                  : "Connect to start"}
              </div>
            ) : (
              sessionList.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer group",
                    activeSessionId === session.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                  onClick={() => setActiveSession(session.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare className="w-3 h-3 flex-shrink-0" />
                    <span className="text-sm truncate">{session.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDeleteSession(e, session.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))
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
            {/* Project selector */}
            <div className="px-2 mb-2">
              <ProjectSelector
                onSelect={addRecentProject}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8"
                  >
                    <FolderTree className="w-3 h-3" />
                    {currentWorkingDir ? (
                      <span className="truncate text-xs">
                        {currentWorkingDir.split("/").pop()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Open Project...
                      </span>
                    )}
                  </Button>
                }
              />
            </div>
            {/* File tree */}
            {currentWorkingDir && <FileTree />}
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
          <div className="px-4 py-2 text-xs text-muted-foreground">
            Coming soon...
          </div>
        </CollapsibleSection>
    </div>
  );
}
