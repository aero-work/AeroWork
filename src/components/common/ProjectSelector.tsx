import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFileStore, type RecentProject } from "@/stores/fileStore";
import { useAgentStore } from "@/stores/agentStore";
import { agentAPI } from "@/services/api";
import * as fileService from "@/services/fileService";
import {
  FolderOpen,
  FolderRoot,
  Clock,
  Trash2,
  ChevronRight,
  ChevronUp,
  Folder,
  Home,
  Loader2,
  Search,
} from "lucide-react";

interface ProjectSelectorProps {
  onSelect: (path: string) => void;
  trigger?: React.ReactNode;
}

interface DirectoryEntry {
  name: string;
  path: string;
  isDir: boolean;
  isHidden: boolean;
}

export function ProjectSelector({ onSelect, trigger }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [activeTab, setActiveTab] = useState<"recent" | "browse">("recent");

  // Browse state
  const [browsePath, setBrowsePath] = useState("");
  const [browseEntries, setBrowseEntries] = useState<DirectoryEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

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
      setOpen(false);
    },
    [setWorkingDir, onSelect]
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
    // Shorten home directory
    const home = "/Users/";
    if (path.startsWith(home)) {
      const parts = path.slice(home.length).split("/");
      if (parts.length > 0) {
        return `~/${parts.slice(1).join("/")}`;
      }
    }
    return path;
  };

  // Get home directory path from server or fallback
  const getHomePath = () => {
    return serverHome || "/";
  };

  // Load directory contents for browsing
  const loadDirectory = useCallback(async (path: string) => {
    if (!isConnected) {
      setBrowseError("Connect to server first to browse directories");
      return;
    }

    setBrowseLoading(true);
    setBrowseError(null);

    try {
      const entries = await fileService.listDirectory(path, false);
      // Filter to only show directories
      const dirs = entries.filter((e) => e.isDir);
      // Sort alphabetically
      dirs.sort((a, b) => a.name.localeCompare(b.name));
      setBrowseEntries(dirs);
      setBrowsePath(path);
    } catch (error) {
      console.error("Failed to load directory:", error);
      setBrowseError(error instanceof Error ? error.message : "Failed to load directory");
      setBrowseEntries([]);
    } finally {
      setBrowseLoading(false);
    }
  }, [isConnected]);

  // Navigate to parent directory
  const navigateUp = useCallback(() => {
    if (!browsePath || browsePath === "/") return;
    const parentPath = browsePath.substring(0, browsePath.lastIndexOf("/")) || "/";
    loadDirectory(parentPath);
  }, [browsePath, loadDirectory]);

  // Navigate into a directory
  const navigateInto = useCallback((path: string) => {
    loadDirectory(path);
  }, [loadDirectory]);

  // Select current browse path as project
  const selectBrowsePath = useCallback(() => {
    if (browsePath) {
      handleSelectProject(browsePath);
    }
  }, [browsePath, handleSelectProject]);

  // Initialize browse path when switching to browse tab
  useEffect(() => {
    if (activeTab === "browse" && !browsePath && isConnected) {
      const initialPath = currentWorkingDir || getHomePath();
      loadDirectory(initialPath);
    }
  }, [activeTab, browsePath, currentWorkingDir, isConnected, loadDirectory]);

  // Reset browse state when dialog closes
  useEffect(() => {
    if (!open) {
      setBrowsePath("");
      setBrowseEntries([]);
      setBrowseError(null);
      setActiveTab("recent");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="w-4 h-4" />
            {currentWorkingDir ? (
              <span className="max-w-32 truncate">
                {currentWorkingDir.split("/").pop()}
              </span>
            ) : (
              "Open Project"
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderRoot className="w-5 h-5" />
            Open Project
          </DialogTitle>
          <DialogDescription>
            Select a project directory to work with
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "recent" | "browse")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent" className="gap-2">
              <Clock className="w-4 h-4" />
              Recent
            </TabsTrigger>
            <TabsTrigger value="browse" className="gap-2">
              <Search className="w-4 h-4" />
              Browse
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter directory path..."
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCustomPath();
                  }
                }}
              />
              <Button onClick={handleCustomPath} disabled={!customPath.trim()}>
                Open
              </Button>
            </div>

            {recentProjects.length > 0 && (
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {recentProjects.map((project: RecentProject) => (
                    <div
                      key={project.path}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer group"
                      onClick={() => handleSelectProject(project.path)}
                    >
                      <FolderOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {project.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {formatPath(project.path)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        onClick={(e: React.MouseEvent) => handleRemoveRecent(e, project.path)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {recentProjects.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent projects</p>
                <p className="text-sm">Enter a path above to get started</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="browse" className="space-y-4">
            {!isConnected ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Connect to server first</p>
                <p className="text-sm">Directory browsing requires a connection</p>
              </div>
            ) : (
              <>
                {/* Current path and navigation */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={navigateUp}
                    disabled={!browsePath || browsePath === "/" || browseLoading}
                    title="Go to parent directory"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => loadDirectory(getHomePath())}
                    disabled={browseLoading}
                    title="Go to home directory"
                  >
                    <Home className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate">
                    {browsePath || "/"}
                  </div>
                </div>

                {/* Error message */}
                {browseError && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {browseError}
                  </div>
                )}

                {/* Directory listing */}
                <ScrollArea className="h-64">
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : browseEntries.length > 0 ? (
                    <div className="space-y-1">
                      {browseEntries.map((entry) => (
                        <div
                          key={entry.path}
                          className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => navigateInto(entry.path)}
                        >
                          <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <span className="flex-1 truncate">{entry.name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No subdirectories</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Select button */}
                <div className="flex justify-end pt-2 border-t">
                  <Button onClick={selectBrowsePath} disabled={!browsePath}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Open This Folder
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
