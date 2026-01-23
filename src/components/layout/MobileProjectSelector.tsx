import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFileStore, type RecentProject } from "@/stores/fileStore";
import { useAgentStore } from "@/stores/agentStore";
import { agentAPI } from "@/services/api";
import * as fileService from "@/services/fileService";
import {
  FolderOpen,
  Clock,
  Trash2,
  ChevronRight,
  ChevronUp,
  Folder,
  Home,
  Loader2,
  X,
  Check,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileProjectSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}

interface DirectoryEntry {
  name: string;
  path: string;
  isDir: boolean;
  isHidden: boolean;
}

export function MobileProjectSelector({ open, onClose, onSelect }: MobileProjectSelectorProps) {
  const [customPath, setCustomPath] = useState("");
  const [activeTab, setActiveTab] = useState<"recent" | "browse">("recent");

  // Browse state
  const [browsePath, setBrowsePath] = useState("");
  const [browseEntries, setBrowseEntries] = useState<DirectoryEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // New folder state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const {
    currentWorkingDir,
    recentProjects,
    setWorkingDir,
    serverHome,
  } = useFileStore();

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const isConnected = connectionStatus === "connected";

  const handleSelectProject = useCallback(
    async (path: string) => {
      // Sync to server (also updates local state)
      await agentAPI.addRecentProject(path);
      // Set as current working directory
      setWorkingDir(path);
      onSelect(path);
      onClose();
    },
    [setWorkingDir, onSelect, onClose]
  );

  const handleCustomPath = useCallback(() => {
    if (customPath.trim()) {
      handleSelectProject(customPath.trim());
      setCustomPath("");
    }
  }, [customPath, handleSelectProject]);

  const handleRemoveRecent = useCallback(
    async (e: React.MouseEvent, path: string) => {
      e.stopPropagation();
      await agentAPI.removeRecentProject(path);
    },
    []
  );

  const formatPath = (path: string) => {
    const home = "/Users/";
    if (path.startsWith(home)) {
      const parts = path.slice(home.length).split("/");
      if (parts.length > 0) {
        return `~/${parts.slice(1).join("/")}`;
      }
    }
    return path;
  };

  const getHomePath = () => {
    return serverHome || "/";
  };

  const loadDirectory = useCallback(async (path: string) => {
    if (!isConnected) {
      setBrowseError("Connect to server first");
      return;
    }

    setBrowseLoading(true);
    setBrowseError(null);

    try {
      const entries = await fileService.listDirectory(path, false);
      const dirs = entries.filter((e) => e.isDir);
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      setBrowseEntries(dirs);
      setBrowsePath(path);
    } catch (error) {
      console.error("Failed to load directory:", error);
      setBrowseError(error instanceof Error ? error.message : "Failed to load");
      setBrowseEntries([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [isConnected]);

  const navigateUp = useCallback(() => {
    if (!browsePath || browsePath === "/") return;
    const parentPath = browsePath.substring(0, browsePath.lastIndexOf("/")) || "/";
    loadDirectory(parentPath);
  }, [browsePath, loadDirectory]);

  const navigateInto = useCallback((path: string) => {
    loadDirectory(path);
  }, [loadDirectory]);

  const selectBrowsePath = useCallback(() => {
    if (browsePath) {
      handleSelectProject(browsePath);
    }
  }, [browsePath, handleSelectProject]);

  // Create new folder
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || !browsePath) return;

    setCreatingFolder(true);
    try {
      const newFolderPath = `${browsePath}/${newFolderName.trim()}`;
      await fileService.createDirectory(newFolderPath);
      await loadDirectory(browsePath);
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (error) {
      console.error("Failed to create folder:", error);
      setBrowseError(error instanceof Error ? error.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }, [newFolderName, browsePath, loadDirectory]);

  const handleCancelNewFolder = useCallback(() => {
    setNewFolderName("");
    setShowNewFolderInput(false);
  }, []);

  useEffect(() => {
    if (activeTab === "browse" && !browsePath && isConnected) {
      const initialPath = currentWorkingDir || getHomePath();
      loadDirectory(initialPath);
    }
  }, [activeTab, browsePath, currentWorkingDir, isConnected, loadDirectory]);

  useEffect(() => {
    if (!open) {
      setBrowsePath("");
      setBrowseEntries([]);
      setBrowseError(null);
      setActiveTab("recent");
      setCustomPath("");
      setShowNewFolderInput(false);
      setNewFolderName("");
    }
  }, [open]);

  useEffect(() => {
    setShowNewFolderInput(false);
    setNewFolderName("");
  }, [activeTab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
          <X className="w-5 h-5" />
        </Button>
        <h1 className="font-semibold text-base">Open Project</h1>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "recent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
          onClick={() => setActiveTab("recent")}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Recent
        </button>
        <button
          className={cn(
            "flex-1 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "browse"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground"
          )}
          onClick={() => setActiveTab("browse")}
        >
          <Folder className="w-4 h-4 inline mr-2" />
          Browse
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "recent" ? (
          <div className="h-full flex flex-col">
            {/* Custom path input */}
            <div className="flex gap-2 p-4 border-b border-border flex-shrink-0">
              <Input
                placeholder="Enter directory path..."
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomPath();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleCustomPath} disabled={!customPath.trim()}>
                Open
              </Button>
            </div>

            {/* Recent projects list */}
            <ScrollArea className="flex-1">
              {recentProjects.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentProjects.map((project: RecentProject) => (
                    <div
                      key={project.path}
                      className="flex items-center gap-3 px-4 py-3 active:bg-accent cursor-pointer"
                      onClick={() => handleSelectProject(project.path)}
                    >
                      <FolderOpen className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{project.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatPath(project.path)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e: React.MouseEvent) => handleRemoveRecent(e, project.path)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4">
                  <FolderOpen className="w-16 h-16 opacity-20 mb-4" />
                  <p className="font-medium mb-1">No Recent Projects</p>
                  <p className="text-sm text-center">Enter a path above to get started</p>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground px-4">
                <FolderOpen className="w-16 h-16 opacity-20 mb-4" />
                <p className="font-medium mb-1">Not Connected</p>
                <p className="text-sm text-center">Connect to server first to browse</p>
              </div>
            ) : (
              <>
                {/* Navigation bar */}
                <div className="flex items-center gap-2 p-3 border-b border-border flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={navigateUp}
                    disabled={!browsePath || browsePath === "/" || browseLoading}
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => loadDirectory(getHomePath())}
                    disabled={browseLoading}
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <Home className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewFolderInput(true)}
                    disabled={browseLoading || !browsePath || showNewFolderInput}
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate min-w-0">
                    {browsePath || "/"}
                  </div>
                </div>

                {/* New folder input */}
                {showNewFolderInput && (
                  <div className="flex gap-2 p-3 border-b border-border flex-shrink-0">
                    <Input
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateFolder();
                        } else if (e.key === "Escape") {
                          handleCancelNewFolder();
                        }
                      }}
                      disabled={creatingFolder}
                      autoFocus
                      className="flex-1"
                    />
                    <Button
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || creatingFolder}
                      size="sm"
                    >
                      {creatingFolder ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelNewFolder}
                      disabled={creatingFolder}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Error message */}
                {browseError && (
                  <div className="mx-4 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {browseError}
                  </div>
                )}

                {/* Directory listing */}
                <ScrollArea className="flex-1">
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : browseEntries.length > 0 ? (
                    <div className="divide-y divide-border">
                      {browseEntries.map((entry) => (
                        <div
                          key={entry.path}
                          className="flex items-center gap-3 px-4 py-3 active:bg-accent cursor-pointer"
                          onClick={() => navigateInto(entry.path)}
                        >
                          <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                          <span className="flex-1 truncate">{entry.name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Folder className="w-12 h-12 opacity-20 mb-4" />
                      <p className="text-sm">No subdirectories</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Select button */}
                <div className="p-4 border-t border-border flex-shrink-0">
                  <Button
                    onClick={selectBrowsePath}
                    disabled={!browsePath}
                    className="w-full h-12"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Open This Folder
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
