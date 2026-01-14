import { useEffect, useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import * as fileService from "@/services/fileService";
import { useFileStore, type FileEntry, type FileTreeNode } from "@/stores/fileStore";
import { useAgentStore } from "@/stores/agentStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMobileNavStore } from "@/stores/mobileNavStore";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getFileType, getMimeType, getMonacoLanguage } from "@/lib/fileTypes";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Loader2,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
} from "lucide-react";


interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isRenaming: boolean;
  isMobile: boolean;
  onToggle: (path: string) => void;
  onSelect: (node: FileTreeNode) => void;
  onOpen: (node: FileTreeNode) => void;
  onRename: (oldPath: string, newName: string) => void;
  onDelete: (node: FileTreeNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onStartRename: (path: string) => void;
  onCancelRename: () => void;
}

function FileTreeItem({
  node,
  depth,
  isExpanded,
  isSelected,
  isRenaming,
  isMobile,
  onToggle,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onStartRename,
  onCancelRename,
}: FileTreeItemProps) {
  const [newName, setNewName] = useState(node.name);

  const handleClick = () => {
    onSelect(node);
    if (node.isDir) {
      onToggle(node.path);
    } else {
      // Single click opens the file on both mobile and desktop
      onOpen(node);
    }
  };

  const handleRenameSubmit = () => {
    if (newName && newName !== node.name) {
      onRename(node.path, newName);
    } else {
      onCancelRename();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      onCancelRename();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "flex items-center gap-1 px-2 cursor-pointer hover:bg-accent/50 rounded-sm",
            isMobile ? "py-2.5 text-base gap-2" : "py-0.5 text-sm gap-1",
            isSelected && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${depth * (isMobile ? 16 : 12) + 8}px` }}
          onClick={handleClick}
        >
          {/* Expand/collapse chevron for directories */}
          {node.isDir ? (
            <span className={cn("flex items-center justify-center flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")}>
              {node.isLoading ? (
                <Loader2 className={cn("animate-spin", isMobile ? "w-4 h-4" : "w-3 h-3")} />
              ) : isExpanded ? (
                <ChevronDown className={isMobile ? "w-4 h-4" : "w-3 h-3"} />
              ) : (
                <ChevronRight className={isMobile ? "w-4 h-4" : "w-3 h-3"} />
              )}
            </span>
          ) : (
            <span className={cn("flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")} />
          )}

          {/* Icon */}
          {node.isDir ? (
            isExpanded ? (
              <FolderOpen className={cn("text-yellow-500 flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")} />
            ) : (
              <Folder className={cn("text-yellow-500 flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")} />
            )
          ) : (
            <File className={cn("text-muted-foreground flex-shrink-0", isMobile ? "w-5 h-5" : "w-4 h-4")} />
          )}

          {/* Name or rename input */}
          {isRenaming ? (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              className="h-5 py-0 px-1 text-sm flex-1 min-w-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn("truncate min-w-0", node.isHidden && "opacity-60")}>
              {node.name}
            </span>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {node.isDir && (
          <>
            <ContextMenuItem onSelect={() => onCreateFile(node.path)}>
              <FilePlus className="w-4 h-4 mr-2" />
              New File
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCreateFolder(node.path)}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={() => onStartRename(node.path)}>
          <Pencil className="w-4 h-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onDelete(node)} destructive>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface FileTreeBranchProps {
  nodes: FileTreeNode[];
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  renamingPath: string | null;
  isMobile: boolean;
  onToggle: (path: string) => void;
  onSelect: (node: FileTreeNode) => void;
  onOpen: (node: FileTreeNode) => void;
  onRename: (oldPath: string, newName: string) => void;
  onDelete: (node: FileTreeNode) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onStartRename: (path: string) => void;
  onCancelRename: () => void;
}

function FileTreeBranch({
  nodes,
  depth,
  expandedPaths,
  selectedPath,
  renamingPath,
  isMobile,
  onToggle,
  onSelect,
  onOpen,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
  onStartRename,
  onCancelRename,
}: FileTreeBranchProps) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = selectedPath === node.path;
        const isRenaming = renamingPath === node.path;

        return (
          <div key={node.path}>
            <FileTreeItem
              node={node}
              depth={depth}
              isExpanded={isExpanded}
              isSelected={isSelected}
              isRenaming={isRenaming}
              isMobile={isMobile}
              onToggle={onToggle}
              onSelect={onSelect}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onStartRename={onStartRename}
              onCancelRename={onCancelRename}
            />
            {node.isDir && isExpanded && node.children && (
              <FileTreeBranch
                nodes={node.children}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                renamingPath={renamingPath}
                isMobile={isMobile}
                onToggle={onToggle}
                onSelect={onSelect}
                onOpen={onOpen}
                onRename={onRename}
                onDelete={onDelete}
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                onStartRename={onStartRename}
                onCancelRename={onCancelRename}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// New file/folder input component
interface NewItemInputProps {
  parentPath: string;
  type: "file" | "folder";
  depth: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

function NewItemInput({ type, depth, onSubmit, onCancel }: NewItemInputProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-4 h-4" />
      {type === "folder" ? (
        <Folder className="w-4 h-4 text-yellow-500" />
      ) : (
        <File className="w-4 h-4 text-muted-foreground" />
      )}
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        placeholder={type === "folder" ? "folder name" : "file name"}
        className="h-5 py-0 px-1 text-sm flex-1"
        autoFocus
      />
    </div>
  );
}

export function FileTree() {
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const fileTree = useFileStore((state) => state.fileTree);
  const expandedPaths = useFileStore((state) => state.expandedPaths);
  const selectedPath = useFileStore((state) => state.selectedPath);
  const showHiddenFiles = useSettingsStore((state) => state.showHiddenFiles);
  const updateDirectoryChildren = useFileStore((state) => state.updateDirectoryChildren);
  const toggleDirectory = useFileStore((state) => state.toggleDirectory);
  const setSelectedPath = useFileStore((state) => state.setSelectedPath);
  const setDirectoryLoading = useFileStore((state) => state.setDirectoryLoading);
  const openFile = useFileStore((state) => state.openFile);
  const closeFile = useFileStore((state) => state.closeFile);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const isConnected = connectionStatus === "connected";
  const closeSettings = useSettingsStore((state) => state.closeSettings);
  const showEditor = useFileStore((state) => state.showEditor);
  const isMobile = useIsMobile();
  const openFileViewer = useMobileNavStore((state) => state.openFileViewer);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{
    parentPath: string;
    type: "file" | "folder";
    depth: number;
  } | null>(null);

  // Track if we've loaded since connection
  const hasLoadedRef = useRef(false);

  // Refs to avoid stale closures in effects that shouldn't re-run on these changes
  const loadDirectoryRef = useRef<(path: string) => Promise<void>>(undefined);
  const expandedPathsRef = useRef(expandedPaths);
  const isConnectedRef = useRef(isConnected);
  const currentWorkingDirRef = useRef(currentWorkingDir);

  // Keep refs updated
  useEffect(() => {
    expandedPathsRef.current = expandedPaths;
    isConnectedRef.current = isConnected;
    currentWorkingDirRef.current = currentWorkingDir;
  });

  // Load directory contents
  const loadDirectory = useCallback(
    async (path: string) => {
      try {
        setDirectoryLoading(path, true);
        const entries = await fileService.listDirectory(path, showHiddenFiles);
        // Convert to FileEntry format expected by store
        const convertedEntries: FileEntry[] = entries.map((e) => ({
          name: e.name,
          path: e.path,
          isDir: e.isDir,
          isHidden: e.isHidden,
          size: e.size,
          modified: e.modified,
        }));
        updateDirectoryChildren(path, convertedEntries);
      } catch (error) {
        console.error("Failed to load directory:", error);
        setDirectoryLoading(path, false);
      }
    },
    [showHiddenFiles, updateDirectoryChildren, setDirectoryLoading]
  );

  // Keep loadDirectory ref updated
  useEffect(() => {
    loadDirectoryRef.current = loadDirectory;
  }, [loadDirectory]);

  // Load root directory when connected and working dir is set
  useEffect(() => {
    if (isConnected && currentWorkingDir) {
      // Load if tree is empty or if we haven't loaded since connecting
      if (fileTree.length === 0 || !hasLoadedRef.current) {
        hasLoadedRef.current = true;
        loadDirectory(currentWorkingDir);
      }
    }
    // Reset the flag when disconnected
    if (!isConnected) {
      hasLoadedRef.current = false;
    }
  }, [isConnected, currentWorkingDir, fileTree.length, loadDirectory]);

  // Get refresh trigger for external refresh requests
  const refreshTrigger = useFileStore((state) => state.refreshTrigger);

  // Reload when hidden files toggle changes or refresh is triggered
  // Uses refs to avoid triggering on every isConnected/currentWorkingDir/expandedPaths change
  useEffect(() => {
    const loadDir = loadDirectoryRef.current;
    const cwd = currentWorkingDirRef.current;
    const connected = isConnectedRef.current;
    const expanded = expandedPathsRef.current;

    if (connected && cwd && loadDir) {
      loadDir(cwd);
      // Also reload expanded directories
      expanded.forEach((path) => {
        loadDir(path);
      });
    }
  }, [showHiddenFiles, refreshTrigger]);

  // Handle directory toggle
  const handleToggle = useCallback(
    async (path: string) => {
      const isCurrentlyExpanded = expandedPaths.has(path);

      if (!isCurrentlyExpanded) {
        // Load contents when expanding
        await loadDirectory(path);
      }

      toggleDirectory(path);
    },
    [expandedPaths, loadDirectory, toggleDirectory]
  );

  // Handle file selection
  const handleSelect = useCallback(
    (node: FileTreeNode) => {
      setSelectedPath(node.path);
    },
    [setSelectedPath]
  );

  // Handle file open (single click on both desktop and mobile)
  const handleOpen = useCallback(
    async (node: FileTreeNode) => {
      if (node.isDir) return;

      closeSettings(); // Close settings when opening a file

      const fileType = getFileType(node.path);
      const mimeType = getMimeType(node.path);

      try {
        if (fileType === "text") {
          // Text files - read as text
          const result = await fileService.readFile(node.path);
          const language = getMonacoLanguage(node.path);
          openFile({
            path: result.path,
            name: node.name,
            content: result.content,
            language,
            isDirty: false,
            originalContent: result.content,
            size: node.size,
            modified: node.modified,
            fileType: "text",
            mimeType,
          });
        } else if (fileType === "image" || fileType === "pdf") {
          // Images and PDFs - read as binary (base64)
          const result = await fileService.readFileBinary(node.path);
          openFile({
            path: result.path,
            name: node.name,
            content: result.content, // base64 encoded
            isDirty: false,
            originalContent: result.content,
            size: result.size,
            modified: result.modified,
            fileType,
            mimeType,
          });
        } else {
          // Binary/unknown files - just get file info, don't read content
          const info = await fileService.getFileInfo(node.path);
          openFile({
            path: info.path,
            name: info.name,
            content: "", // No content for binary files
            isDirty: false,
            originalContent: "",
            size: info.size,
            modified: info.modified,
            fileType: "binary",
            mimeType,
          });
        }

        if (isMobile) {
          // On mobile, navigate to file viewer
          openFileViewer(node.path);
        } else {
          // On desktop, switch to editor view
          showEditor();
        }
      } catch (error) {
        console.error("Failed to open file:", error);
      }
    },
    [openFile, closeSettings, isMobile, openFileViewer, showEditor]
  );

  // Handle rename
  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${parentPath}/${newName}`;

      try {
        await fileService.renamePath(oldPath, newPath);
        // Reload parent directory
        await loadDirectory(parentPath);
        setRenamingPath(null);
      } catch (error) {
        console.error("Failed to rename:", error);
      }
    },
    [loadDirectory]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (node: FileTreeNode) => {
      // Confirm deletion
      if (!confirm(`Delete "${node.name}"?`)) return;

      try {
        await fileService.deletePath(node.path);
        // Close file if it was open
        if (!node.isDir) {
          closeFile(node.path);
        }
        // Reload parent directory
        const parentPath = node.path.substring(0, node.path.lastIndexOf("/"));
        await loadDirectory(parentPath || currentWorkingDir!);
      } catch (error) {
        console.error("Failed to delete:", error);
      }
    },
    [loadDirectory, currentWorkingDir, closeFile]
  );

  // Handle create file
  const handleCreateFile = useCallback(
    (parentPath: string) => {
      // Find depth
      let depth = 0;
      if (parentPath !== currentWorkingDir) {
        const findDepth = (nodes: FileTreeNode[], d: number): number => {
          for (const node of nodes) {
            if (node.path === parentPath) return d + 1;
            if (node.children) {
              const found = findDepth(node.children, d + 1);
              if (found >= 0) return found;
            }
          }
          return -1;
        };
        depth = Math.max(findDepth(fileTree, 0), 1);
      }
      setNewItem({ parentPath, type: "file", depth });
    },
    [currentWorkingDir, fileTree]
  );

  // Handle create folder
  const handleCreateFolder = useCallback(
    (parentPath: string) => {
      let depth = 0;
      if (parentPath !== currentWorkingDir) {
        const findDepth = (nodes: FileTreeNode[], d: number): number => {
          for (const node of nodes) {
            if (node.path === parentPath) return d + 1;
            if (node.children) {
              const found = findDepth(node.children, d + 1);
              if (found >= 0) return found;
            }
          }
          return -1;
        };
        depth = Math.max(findDepth(fileTree, 0), 1);
      }
      setNewItem({ parentPath, type: "folder", depth });
    },
    [currentWorkingDir, fileTree]
  );

  // Submit new item creation
  const handleNewItemSubmit = useCallback(
    async (name: string) => {
      if (!newItem) return;

      const path = `${newItem.parentPath}/${name}`;

      try {
        if (newItem.type === "folder") {
          await fileService.createDirectory(path);
        } else {
          await fileService.createFile(path);
        }
        // Reload parent directory
        await loadDirectory(newItem.parentPath);
        setNewItem(null);
      } catch (error) {
        console.error("Failed to create:", error);
      }
    },
    [newItem, loadDirectory]
  );

  if (!currentWorkingDir) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Select a project to browse files
      </div>
    );
  }

  if (fileTree.length === 0) {
    if (!isConnected) {
      return (
        <div className="p-4 text-sm text-muted-foreground text-center">
          Connect to browse files
        </div>
      );
    }
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
        Loading...
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="py-1">
          <FileTreeBranch
            nodes={fileTree}
            depth={0}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            renamingPath={renamingPath}
            isMobile={isMobile}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onOpen={handleOpen}
            onRename={handleRename}
            onDelete={handleDelete}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onStartRename={setRenamingPath}
            onCancelRename={() => setRenamingPath(null)}
          />
          {newItem && (
            <NewItemInput
              parentPath={newItem.parentPath}
              type={newItem.type}
              depth={newItem.depth}
              onSubmit={handleNewItemSubmit}
              onCancel={() => setNewItem(null)}
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => handleCreateFile(currentWorkingDir)}>
          <FilePlus className="w-4 h-4 mr-2" />
          New File
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => handleCreateFolder(currentWorkingDir)}>
          <FolderPlus className="w-4 h-4 mr-2" />
          New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
