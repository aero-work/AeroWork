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

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language?: string;
  isDirty: boolean;
  originalContent: string;
}

export interface FileTreeNode extends FileEntry {
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

interface FileState {
  currentWorkingDir: string | null;
  recentProjects: RecentProject[];
  // File tree state
  fileTree: FileTreeNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  // Open files (tabs)
  openFiles: OpenFile[];
  activeFilePath: string | null;
  // Settings
  showHiddenFiles: boolean;
}

interface FileActions {
  // Project management
  setWorkingDir: (path: string) => void;
  addRecentProject: (path: string, name?: string) => void;
  removeRecentProject: (path: string) => void;
  clearRecentProjects: () => void;
  // File tree
  setFileTree: (entries: FileEntry[]) => void;
  updateDirectoryChildren: (dirPath: string, children: FileEntry[]) => void;
  toggleDirectory: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  setDirectoryLoading: (path: string, loading: boolean) => void;
  // Open files
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string, newContent?: string) => void;
  // Settings
  toggleHiddenFiles: () => void;
}

const MAX_RECENT_PROJECTS = 10;

export const useFileStore = create<FileState & FileActions>()(
  persist(
    immer((set) => ({
      currentWorkingDir: null,
      recentProjects: [],
      fileTree: [],
      expandedPaths: new Set<string>(),
      selectedPath: null,
      openFiles: [],
      activeFilePath: null,
      showHiddenFiles: false,

      setWorkingDir: (path) => {
        set((state) => {
          state.currentWorkingDir = path;
          // Reset file tree when changing directory
          state.fileTree = [];
          state.expandedPaths = new Set();
          state.selectedPath = null;
        });
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
          state.currentWorkingDir = path;
          // Reset file tree
          state.fileTree = [];
          state.expandedPaths = new Set();
          state.selectedPath = null;
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

      toggleHiddenFiles: () => {
        set((state) => {
          state.showHiddenFiles = !state.showHiddenFiles;
        });
      },
    })),
    {
      name: "aero-code-files",
      partialize: (state) => ({
        recentProjects: state.recentProjects,
        currentWorkingDir: state.currentWorkingDir,
        showHiddenFiles: state.showHiddenFiles,
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
