import { useCallback, useRef, useEffect } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useFileStore, useActiveFile } from "@/stores/fileStore";
import * as fileService from "@/services/fileService";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";
import { Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/fileTypes";

interface CodeEditorProps {
  onTogglePreview?: () => void;
}

export function CodeEditor({ onTogglePreview }: CodeEditorProps = {}) {
  const activeFile = useActiveFile();
  const updateFileContent = useFileStore((state) => state.updateFileContent);
  const markFileSaved = useFileStore((state) => state.markFileSaved);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const isDark = useIsDarkMode();

  // Use ref to store latest handleSave to avoid stale closure in Monaco command
  const handleSaveRef = useRef<() => Promise<void>>(undefined);

  const handleSave = useCallback(async () => {
    if (!activeFile || !activeFile.isDirty) return;

    try {
      await fileService.writeFile(activeFile.path, activeFile.content);
      markFileSaved(activeFile.path);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [activeFile, markFileSaved]);

  // Keep ref updated with latest handleSave
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add save command (Ctrl/Cmd+S)
    // Use ref to always call the latest handleSave version
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveRef.current?.();
    });
  }, []);

  const handleChange: OnChange = useCallback(
    (value) => {
      if (activeFile && value !== undefined) {
        updateFileContent(activeFile.path, value);
      }
    },
    [activeFile, updateFileContent]
  );

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/20">
        <div className="text-center">
          <p className="text-lg mb-2">No file open</p>
          <p className="text-sm">Double-click a file in the explorer to open it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar (only shown when preview toggle is available) */}
      {onTogglePreview && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">
            {activeFile.name} • {formatFileSize(activeFile.size)}
          </span>
          <Button variant="ghost" size="sm" onClick={onTogglePreview}>
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        </div>
      )}

      {/* Editor */}
      <Editor
        height="100%"
        language={activeFile.language || "plaintext"}
        value={activeFile.content}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={isDark ? "vs-dark" : "light"}
        loading={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        }
        options={{
          minimap: { enabled: true },
          fontSize: 13,
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
      />
    </div>
  );
}
