import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useFileStore, useActiveFile, type OpenFile } from "@/stores/fileStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as fileService from "@/services/fileService";
import { X, FileText, Save, Download, Upload } from "lucide-react";

interface TabProps {
  file: OpenFile;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function Tab({ file, isActive, onSelect, onClose }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-border group min-w-0",
        isActive
          ? "bg-background text-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted"
      )}
      onClick={onSelect}
    >
      <FileText className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="text-sm truncate max-w-32">
        {file.isDirty && <span className="text-primary mr-0.5">*</span>}
        {file.name}
      </span>
      <button
        className={cn(
          "w-4 h-4 flex items-center justify-center rounded-sm hover:bg-accent flex-shrink-0",
          "opacity-0 group-hover:opacity-100",
          isActive && "opacity-60 group-hover:opacity-100"
        )}
        onClick={handleClose}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function EditorTabs() {
  const { t } = useTranslation();
  const openFiles = useFileStore((state) => state.openFiles);
  const activeFilePath = useFileStore((state) => state.activeFilePath);
  const setActiveFile = useFileStore((state) => state.setActiveFile);
  const closeFile = useFileStore((state) => state.closeFile);
  const markFileSaved = useFileStore((state) => state.markFileSaved);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);
  const triggerRefresh = useFileStore((state) => state.triggerRefresh);
  const activeFile = useActiveFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for unsaved changes confirmation dialog
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);

  const handleSelect = useCallback(
    (path: string) => {
      setActiveFile(path);
    },
    [setActiveFile]
  );

  const handleClose = useCallback(
    (path: string) => {
      // Check if file has unsaved changes
      const file = openFiles.find((f) => f.path === path);
      if (file?.isDirty) {
        setPendingClosePath(path);
        setUnsavedDialogOpen(true);
        return;
      }
      closeFile(path);
    },
    [closeFile, openFiles]
  );

  // Close file without saving (discard changes)
  const handleDiscardAndClose = useCallback(() => {
    if (pendingClosePath) {
      closeFile(pendingClosePath);
      setPendingClosePath(null);
    }
    setUnsavedDialogOpen(false);
  }, [closeFile, pendingClosePath]);

  // Save file and then close
  const handleSaveAndClose = useCallback(async () => {
    if (pendingClosePath) {
      const file = openFiles.find((f) => f.path === pendingClosePath);
      if (file) {
        try {
          await fileService.writeFile(file.path, file.content);
          markFileSaved(file.path);
          closeFile(pendingClosePath);
        } catch (error) {
          console.error("Failed to save file:", error);
        }
      }
      setPendingClosePath(null);
    }
    setUnsavedDialogOpen(false);
  }, [closeFile, markFileSaved, openFiles, pendingClosePath]);

  // Save file to backend
  const handleSave = useCallback(async () => {
    if (!activeFile || !activeFile.isDirty) return;
    try {
      await fileService.writeFile(activeFile.path, activeFile.content);
      markFileSaved(activeFile.path);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [activeFile, markFileSaved]);

  // Download file to local machine
  const handleDownload = useCallback(() => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeFile]);

  // Upload file from local machine to current working directory
  const handleUpload = useCallback(() => {
    if (!currentWorkingDir) {
      console.warn("Please open a project first");
      return;
    }
    fileInputRef.current?.click();
  }, [currentWorkingDir]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentWorkingDir) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Content = btoa(binary);

        // Save file to current working directory
        const filePath = `${currentWorkingDir}/${file.name}`;
        try {
          await fileService.writeFileBinary(filePath, base64Content);
          // Refresh file tree to show the new file
          triggerRefresh();
        } catch (error) {
          console.error("Failed to upload file:", error);
        }
      };
      reader.readAsArrayBuffer(file);

      // Reset input so same file can be uploaded again
      e.target.value = "";
    },
    [currentWorkingDir, triggerRefresh]
  );

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b border-border bg-muted/30">
      {/* File tabs */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {openFiles.map((file) => (
          <Tab
            key={file.path}
            file={file}
            isActive={activeFilePath === file.path}
            onSelect={() => handleSelect(file.path)}
            onClose={() => handleClose(file.path)}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2 border-l border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleSave}
          disabled={!activeFile?.isDirty}
          title="Save (Ctrl+S)"
        >
          <Save className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDownload}
          disabled={!activeFile}
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleUpload}
          title="Upload file"
        >
          <Upload className="w-4 h-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="*/*"
        />
      </div>

      {/* Unsaved changes confirmation dialog */}
      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editor.unsavedChanges")}</DialogTitle>
            <DialogDescription>
              {t("editor.unsavedChangesDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setUnsavedDialogOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDiscardAndClose}>
              {t("editor.discardChanges")}
            </Button>
            <Button onClick={handleSaveAndClose}>
              {t("editor.saveAndClose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
