import { useCallback, useRef } from "react";
import Editor, { type OnMount, type OnChange } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useFileStore, useActiveFile } from "@/stores/fileStore";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";

export function CodeEditor() {
  const activeFile = useActiveFile();
  const updateFileContent = useFileStore((state) => state.updateFileContent);
  const markFileSaved = useFileStore((state) => state.markFileSaved);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add save command (Ctrl/Cmd+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
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

  const handleSave = useCallback(async () => {
    if (!activeFile || !activeFile.isDirty) return;

    try {
      await invoke("write_file", {
        path: activeFile.path,
        content: activeFile.content,
      });
      markFileSaved(activeFile.path);
    } catch (error) {
      console.error("Failed to save file:", error);
    }
  }, [activeFile, markFileSaved]);

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
      <Editor
        height="100%"
        language={activeFile.language || "plaintext"}
        value={activeFile.content}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme="vs-dark"
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
