import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useFileStore, type OpenFile } from "@/stores/fileStore";
import { X, FileText } from "lucide-react";

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
  const openFiles = useFileStore((state) => state.openFiles);
  const activeFilePath = useFileStore((state) => state.activeFilePath);
  const setActiveFile = useFileStore((state) => state.setActiveFile);
  const closeFile = useFileStore((state) => state.closeFile);

  const handleSelect = useCallback(
    (path: string) => {
      setActiveFile(path);
    },
    [setActiveFile]
  );

  const handleClose = useCallback(
    (path: string) => {
      // TODO: Check for unsaved changes before closing
      closeFile(path);
    },
    [closeFile]
  );

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b border-border bg-muted/30 overflow-x-auto">
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
  );
}
