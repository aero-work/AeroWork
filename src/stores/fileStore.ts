import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isHidden: boolean;
  size?: number;
  modified?: number;
}

export type FileType = "text" | "image" | "pdf" | "binary";

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isDirty: boolean;
  originalContent: string;
  // File metadata
  size?: number;
  modified?: number;
  fileType?: FileType;
  mimeType?: string;
}

export interface FileTreeNode extends FileEntry {
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export type MainViewMode = "chat" | "editor";

interface FileState {
  currentWorkingDir: string | null;
  recentProjects: RecentProject[];
  // File tree state
  fileTree: FileTreeNode[];
  fileTreeLoaded: boolean; // true after first load completes (even if empty)
  expandedPaths: Set<string>;
  selectedPath: string | null;
  // Open files (tabs)
  openFiles: OpenFile[];
  activeFilePath: string | null;
  // Main view mode (chat or editor)
  mainViewMode: MainViewMode;
  // Refresh trigger (increment to trigger reload)
  refreshTrigger: number;
  // Server paths (from backend)
  serverCwd: string | null;
  serverHome: string | null;
}

interface FileActions {
  // Project management
  setWorkingDir: (path: string) => void;
  addRecentProject: (path: string, name?: string) => void;
  removeRecentProject: (path: string) => void;
  clearRecentProjects: () => void;
  setRecentProjects: (projects: RecentProject[]) => void;
  // Server paths
  setServerPaths: (cwd: string, home: string) => void;
  // File tree
  setFileTree: (entries: FileEntry[]) => void;
  updateDirectoryChildren: (dirPath: string, children: FileEntry[]) => void;
  toggleDirectory: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  setDirectoryLoading: (path: string, loading: boolean) => void;
  // Open files
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string, newContent?: string) => void;
  // View mode
  setMainViewMode: (mode: MainViewMode) => void;
  showChat: () => void;
  showEditor: () => void;
  // Refresh
  triggerRefresh: () => void;
}

const MAX_RECENT_PROJECTS = 10;

export const useFileStore = create<FileState & FileActions>()(
  persist(
    immer((set) => ({
      currentWorkingDir: null,
      recentProjects: [],
      fileTree: [],
      fileTreeLoaded: false,
      expandedPaths: new Set<string>(),
      selectedPath: null,
      openFiles: [],
      activeFilePath: null,
      mainViewMode: "chat",
      refreshTrigger: 0,
      serverCwd: null,
      serverHome: null,

      setWorkingDir: (path) => {
        set((state) => {
          state.currentWorkingDir = path;
          // Reset file tree when changing directory
          state.fileTree = [];
          state.fileTreeLoaded = false;
          state.expandedPaths = new Set();
          state.selectedPath = null;
          // Close files that don't belong to the new project
          state.openFiles = state.openFiles.filter((f) => f.path.startsWith(path));
          // Reset active file if it was closed
          if (state.activeFilePath && !state.activeFilePath.startsWith(path)) {
            state.activeFilePath = state.openFiles.length > 0 ? state.openFiles[0].path : null;
          }
        });

        // Notify server of current project change (for session filtering)
        // This is async but we don't await it to avoid blocking the UI
        (async () => {
          try {
            const { agentAPI } = await import("@/services/api");
            await agentAPI.setCurrentCwd(path);
          } catch (e) {
            console.warn("Failed to set current cwd on server:", e);
          }
        })();
      },

      addRecentProject: (path, name) => {
        set((state) => {
          state.recentProjects = state.recentProjects.filter(
            (p) => p.path !== path
          );
          const projectName = name || path.split("/").pop() || path;
          state.recentProjects.unshift({
            path,
            name: projectName,
            lastOpened: Date.now(),
          });
          if (state.recentProjects.length > MAX_RECENT_PROJECTS) {
            state.recentProjects = state.recentProjects.slice(
              0,
              MAX_RECENT_PROJECTS
            );
          }
          // Only reset file tree if changing to a different directory
          if (state.currentWorkingDir !== path) {
            state.currentWorkingDir = path;
            state.fileTree = [];
            state.fileTreeLoaded = false;
            state.expandedPaths = new Set();
            state.selectedPath = null;
            // Close files that don't belong to the new project
            state.openFiles = state.openFiles.filter((f) => f.path.startsWith(path));
            // Reset active file if it was closed
            if (state.activeFilePath && !state.activeFilePath.startsWith(path)) {
              state.activeFilePath = state.openFiles.length > 0 ? state.openFiles[0].path : null;
            }
          }
        });
      },

      removeRecentProject: (path) => {
        set((state) => {
          state.recentProjects = state.recentProjects.filter(
            (p) => p.path !== path
          );
        });
      },

      clearRecentProjects: () => {
        set((state) => {
          state.recentProjects = [];
        });
      },

      setRecentProjects: (projects) => {
        set((state) => {
          state.recentProjects = projects;
        });
      },

      setServerPaths: (cwd, home) => {
        set((state) => {
          state.serverCwd = cwd;
          state.serverHome = home;
          // Don't auto-set currentWorkingDir - let user select project manually
          // The path from server might not exist or be accessible on client
        });
      },

      setFileTree: (entries) => {
        set((state) => {
          state.fileTree = entries.map((e) => ({ ...e, children: e.isDir ? undefined : undefined }));
        });
      },

      updateDirectoryChildren: (dirPath, children) => {
        set((state) => {
          const updateNode = (nodes: FileTreeNode[]): boolean => {
            for (const node of nodes) {
              if (node.path === dirPath) {
                node.children = children.map((c) => ({ ...c }));
                node.isLoading = false;
                return true;
              }
              if (node.children && updateNode(node.children)) {
                return true;
              }
            }
            return false;
          };

          // Try to update in tree, or add to root if it's the root dir
          if (dirPath === state.currentWorkingDir) {
            state.fileTree = children.map((c) => ({ ...c }));
            state.fileTreeLoaded = true; // Mark as loaded even if empty
          } else {
            updateNode(state.fileTree);
          }
        });
      },

      toggleDirectory: (path) => {
        set((state) => {
          if (state.expandedPaths.has(path)) {
            state.expandedPaths.delete(path);
          } else {
            state.expandedPaths.add(path);
          }
        });
      },

      setSelectedPath: (path) => {
        set((state) => {
          state.selectedPath = path;
        });
      },

      setDirectoryLoading: (path, loading) => {
        set((state) => {
          const updateNode = (nodes: FileTreeNode[]): boolean => {
            for (const node of nodes) {
              if (node.path === path) {
                node.isLoading = loading;
                return true;
              }
              if (node.children && updateNode(node.children)) {
                return true;
              }
            }
            return false;
          };
          updateNode(state.fileTree);
        });
      },

      openFile: (file) => {
        set((state) => {
          const existing = state.openFiles.find((f) => f.path === file.path);
          if (!existing) {
            state.openFiles.push(file);
          }
          state.activeFilePath = file.path;
        });
      },

      closeFile: (path) => {
        set((state) => {
          const index = state.openFiles.findIndex((f) => f.path === path);
          if (index !== -1) {
            state.openFiles.splice(index, 1);
            // Update active file if needed
            if (state.activeFilePath === path) {
              if (state.openFiles.length > 0) {
                // Activate the previous file or the first one
                const newIndex = Math.min(index, state.openFiles.length - 1);
                state.activeFilePath = state.openFiles[newIndex].path;
              } else {
                state.activeFilePath = null;
              }
            }
          }
        });
      },

      closeAllFiles: () => {
        set((state) => {
          state.openFiles = [];
          state.activeFilePath = null;
        });
      },

      setActiveFile: (path) => {
        set((state) => {
          state.activeFilePath = path;
        });
      },

      updateFileContent: (path, content) => {
        set((state) => {
          const file = state.openFiles.find((f) => f.path === path);
          if (file) {
            file.content = content;
            file.isDirty = content !== file.originalContent;
          }
        });
      },

      markFileSaved: (path, newContent) => {
        set((state) => {
          const file = state.openFiles.find((f) => f.path === path);
          if (file) {
            if (newContent !== undefined) {
              file.content = newContent;
              file.originalContent = newContent;
            } else {
              file.originalContent = file.content;
            }
            file.isDirty = false;
          }
        });
      },

      setMainViewMode: (mode) => {
        set((state) => {
          state.mainViewMode = mode;
        });
      },

      showChat: () => {
        set((state) => {
          state.mainViewMode = "chat";
        });
      },

      showEditor: () => {
        set((state) => {
          state.mainViewMode = "editor";
        });
      },

      triggerRefresh: () => {
        set((state) => {
          state.refreshTrigger += 1;
        });
      },
    })),
    {
      name: "aero-work-files",
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        currentWorkingDir: state.currentWorkingDir,
      }),
    }
  )
);

// Selector hooks
export const useActiveFile = () => {
  const activeFilePath = useFileStore((state) => state.activeFilePath);
  const openFiles = useFileStore((state) => state.openFiles);
  return activeFilePath ? openFiles.find((f) => f.path === activeFilePath) : undefined;
};
