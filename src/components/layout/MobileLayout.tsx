import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MobileHeader } from "./MobileHeader";
import { MobileTabBar } from "./MobileTabBar";
import { MobileSessionList } from "./MobileSessionList";
import { MobileConversation } from "./MobileConversation";
import { SettingsPage } from "@/components/settings";
import { XTerminal } from "@/components/terminal/XTerminal";
import { FileTree } from "@/components/editor/FileTree";
import { PermissionDialog } from "@/components/common/PermissionDialog";
import { WsSetupDialog } from "@/components/common/WsSetupDialog";
import { useMobileNavStore, type MobileView } from "@/stores/mobileNavStore";
import { useAgentStore } from "@/stores/agentStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { isMobileTauriApp } from "@/services/transport";
import { agentAPI } from "@/services/api";
import { useFileStore, type OpenFile } from "@/stores/fileStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FolderOpen,
  Plus,
  X,
  Terminal as TerminalIcon,
  Upload,
  FileQuestion,
  FileCode,
  ChevronLeft,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import * as fileService from "@/services/fileService";
import { getLanguageFromPath, formatFileSize, formatModifiedDate } from "@/lib/fileTypes";

// ============================================================================
// File Views
// ============================================================================

function MobileFilesView() {
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const triggerRefresh = useFileStore((state) => state.triggerRefresh);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentWorkingDir) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Content = btoa(binary);

        const filePath = `${currentWorkingDir}/${file.name}`;
        try {
          await fileService.writeFileBinary(filePath, base64Content);
          triggerRefresh();
        } catch (error) {
          console.error("Failed to upload file:", error);
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [currentWorkingDir, triggerRefresh]
  );

  if (!currentWorkingDir) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground px-4">
        <FolderOpen className="w-16 h-16 opacity-20 mb-4" />
        <h2 className="text-lg font-medium text-foreground mb-2">No Project Open</h2>
        <p className="text-sm text-center">
          Open the menu and select a project to browse files.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      <div className="flex-1 overflow-y-auto">
        <FileTree />
      </div>
      <Button
        variant="default"
        size="icon"
        className="absolute bottom-4 right-4 h-12 w-12 rounded-full shadow-lg z-10"
        onClick={handleUpload}
        title="Upload file"
      >
        <Upload className="w-5 h-5" />
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="*/*"
      />
    </div>
  );
}

// ============================================================================
// File Viewer Components
// ============================================================================

function TextFileViewer({ file, isDark }: { file: OpenFile; isDark: boolean }) {
  const language = useMemo(() => getLanguageFromPath(file.path), [file.path]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={isDark ? oneDark : oneLight}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: "1rem",
            fontSize: "0.8rem",
            lineHeight: "1.4",
            background: "transparent",
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: isDark ? "#636d83" : "#9ca3af",
            userSelect: "none",
          }}
          wrapLines
          wrapLongLines
        >
          {file.content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

function ImageFileViewer({ file }: { file: OpenFile }) {
  const dataUrl = useMemo(() => {
    if (!file.content) return null;
    const mimeType = file.mimeType || "image/png";
    return `data:${mimeType};base64,${file.content}`;
  }, [file.content, file.mimeType]);

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Unable to load image</p>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-4 overflow-auto bg-muted/20">
      <img
        src={dataUrl}
        alt={file.name}
        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
      />
    </div>
  );
}

function PdfFileViewer({ file }: { file: OpenFile }) {
  const dataUrl = useMemo(() => {
    if (!file.content) return null;
    return `data:application/pdf;base64,${file.content}`;
  }, [file.content]);

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Unable to load PDF</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <iframe src={dataUrl} className="flex-1 w-full border-0" title={file.name} />
    </div>
  );
}

function BinaryFileViewer({
  file,
  onForceEdit,
}: {
  file: OpenFile;
  onForceEdit: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      <FileQuestion className="w-16 h-16 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">{file.name}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        This file type cannot be previewed
      </p>

      <div className="bg-muted rounded-lg p-4 w-full max-w-sm mb-6">
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Size</span>
          <span className="font-medium">{formatFileSize(file.size)}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">Modified</span>
          <span className="font-medium">{formatModifiedDate(file.modified)}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-muted-foreground">Type</span>
          <span className="font-medium">{file.mimeType || "Unknown"}</span>
        </div>
      </div>

      <Button variant="outline" onClick={onForceEdit}>
        <FileCode className="w-4 h-4 mr-2" />
        Force Edit as Text
      </Button>
    </div>
  );
}

function MobileFileViewer() {
  const viewingFilePath = useMobileNavStore((state) => state.viewingFilePath);
  const goBack = useMobileNavStore((state) => state.goBack);
  const openFiles = useFileStore((state) => state.openFiles);
  const updateFileContent = useFileStore((state) => state.updateFileContent);
  const isDark = useIsDarkMode();
  const [forceTextEdit, setForceTextEdit] = useState<string | null>(null);

  // Swipe back gesture
  const { handlers: swipeHandlers, swipeOffset, isSwiping } = useSwipeBack({
    onSwipeBack: goBack,
    enabled: true,
    threshold: 100,
    edgeWidth: 30,
  });

  const file = openFiles.find((f) => f.path === viewingFilePath);

  useEffect(() => {
    setForceTextEdit(null);
  }, [viewingFilePath]);

  if (!file) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground px-4">
        <p className="text-sm">File not found</p>
      </div>
    );
  }

  const handleForceEdit = async () => {
    try {
      const result = await fileService.readFile(file.path);
      updateFileContent(file.path, result.content);
      setForceTextEdit(file.path);
    } catch (error) {
      console.error("Failed to read file as text:", error);
    }
  };

  const fileType = file.fileType || "text";
  const isForceEditing = forceTextEdit === file.path;

  // Wrap content with swipe gesture
  const wrapWithSwipe = (content: React.ReactNode) => (
    <div
      className={cn(
        "h-full relative",
        !isSwiping && "transition-transform duration-200 ease-out"
      )}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
      }}
      {...swipeHandlers}
    >
      {/* Swipe back indicator */}
      {swipeOffset > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 flex items-center justify-center z-50 pointer-events-none"
          style={{
            width: Math.min(swipeOffset, 60),
            opacity: Math.min(swipeOffset / 100, 1),
          }}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full bg-muted flex items-center justify-center",
              swipeOffset > 100 && "bg-primary text-primary-foreground"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </div>
        </div>
      )}
      {content}
    </div>
  );

  if (isForceEditing || fileType === "text") {
    return wrapWithSwipe(<TextFileViewer file={file} isDark={isDark} />);
  }

  if (fileType === "image") {
    return wrapWithSwipe(<ImageFileViewer file={file} />);
  }

  if (fileType === "pdf") {
    return wrapWithSwipe(<PdfFileViewer file={file} />);
  }

  return wrapWithSwipe(<BinaryFileViewer file={file} onForceEdit={handleForceEdit} />);
}

// ============================================================================
// Terminal View
// ============================================================================

function MobileTerminalView() {
  const terminals = useTerminalStore((state) => state.terminals);
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const createTerminal = useTerminalStore((state) => state.createTerminal);
  const killTerminal = useTerminalStore((state) => state.killTerminal);
  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);

  const handleCreateTerminal = useCallback(async () => {
    const workingDir = currentWorkingDir || "/";
    await createTerminal(workingDir, 80, 24);
  }, [createTerminal, currentWorkingDir]);

  const handleKillTerminal = useCallback(
    async (e: React.MouseEvent, terminalId: string) => {
      e.stopPropagation();
      await killTerminal(terminalId);
    },
    [killTerminal]
  );

  useEffect(() => {
    if (terminals.length === 0 && currentWorkingDir) {
      handleCreateTerminal();
    }
  }, [terminals.length, currentWorkingDir, handleCreateTerminal]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/50 flex-shrink-0">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              role="tab"
              tabIndex={0}
              onClick={() => setActiveTerminal(terminal.id)}
              onKeyDown={(e) => e.key === "Enter" && setActiveTerminal(terminal.id)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer",
                activeTerminalId === terminal.id && "bg-accent"
              )}
            >
              <TerminalIcon className="w-4 h-4" />
              <span className="truncate max-w-[100px]">
                {terminal.working_dir.split("/").pop() || "Terminal"}
              </span>
              <button
                onClick={(e) => handleKillTerminal(e, terminal.id)}
                className="hover:bg-destructive/20 rounded-sm p-0.5 ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleCreateTerminal}
          title="New Terminal"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        {terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <TerminalIcon className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-base mb-3">No terminals open</p>
            <Button variant="outline" size="default" onClick={handleCreateTerminal}>
              <Plus className="w-4 h-4 mr-2" />
              New Terminal
            </Button>
          </div>
        ) : (
          <div className="h-full">
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                className={cn("h-full", activeTerminalId !== terminal.id && "hidden")}
              >
                <XTerminal terminalId={terminal.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Mobile Layout
// ============================================================================

const VIEW_COMPONENTS: Record<MobileView, React.ComponentType> = {
  "session-list": MobileSessionList,
  conversation: MobileConversation,
  files: MobileFilesView,
  "file-viewer": MobileFileViewer,
  terminal: MobileTerminalView,
  settings: SettingsPage,
};

// Extend Window interface for Android callbacks
declare global {
  interface Window {
    androidBackCallback?: () => boolean;
  }
}

export function MobileLayout() {
  const currentView = useMobileNavStore((state) => state.currentView);
  const goBack = useMobileNavStore((state) => state.goBack);
  const showBackButton = useMobileNavStore((state) => state.showBackButton);
  const ViewComponent = VIEW_COMPONENTS[currentView];
  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const wsUrl = useSettingsStore((state) => state.wsUrl);

  // Android back button/gesture handling - register callback for MainActivity.kt
  useEffect(() => {
    window.androidBackCallback = () => {
      // Check if we can navigate back within the app
      if (showBackButton()) {
        goBack();
        return false; // Prevent app exit, we handled it
      }
      return true; // Allow app exit (on main tabs)
    };

    return () => {
      delete window.androidBackCallback;
    };
  }, [goBack, showBackButton]);

  // Android keyboard height - listen to native events from MainActivity.kt
  // Note: Android returns physical pixels, need to convert to CSS pixels
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const handler = (e: CustomEvent<{ height: number }>) => {
      const physicalPx = e.detail?.height || 0;
      // Convert physical pixels to CSS pixels
      const cssPx = Math.round(physicalPx / window.devicePixelRatio);
      setKeyboardHeight(cssPx);
    };
    window.addEventListener("androidKeyboardHeight", handler as EventListener);
    return () => window.removeEventListener("androidKeyboardHeight", handler as EventListener);
  }, []);

  // Check if TabBar is visible for current view
  const isTabBarVisible = useMobileNavStore((state) => state.showTabBar)();

  // Show WS setup dialog for mobile Tauri app when not configured or connection failed
  const [showWsSetup, setShowWsSetup] = useState(false);

  useEffect(() => {
    // On mobile Tauri app, show setup dialog if no URL configured and disconnected
    if (isMobileTauriApp() && !wsUrl && connectionStatus === "disconnected") {
      setShowWsSetup(true);
    }
  }, [wsUrl, connectionStatus]);

  const handleWsConnect = useCallback(() => {
    agentAPI.connect().catch(console.error);
  }, []);

  // Calculate container height when keyboard is open
  // TabBar height: h-14 (56px) - when visible, subtract less so TabBar gets pushed behind keyboard
  const TAB_BAR_HEIGHT = 56;
  const keyboardOffset = isTabBarVisible ? keyboardHeight - TAB_BAR_HEIGHT : keyboardHeight;

  return (
    <div
      className="flex flex-col bg-background"
      style={{
        height: keyboardHeight > 0 ? `calc(100dvh - ${keyboardOffset}px)` : "100dvh"
      }}
    >
      <MobileHeader />

      <main className="flex-1 min-h-0 overflow-hidden">
        <ViewComponent />
      </main>

      <MobileTabBar />
      <PermissionDialog />
      <WsSetupDialog
        open={showWsSetup}
        onOpenChange={setShowWsSetup}
        onConnect={handleWsConnect}
      />
    </div>
  );
}
