import { useMemo, useState, useCallback } from "react";
import { useFileStore, useActiveFile, type OpenFile } from "@/stores/fileStore";
import { Button } from "@/components/ui/button";
import * as fileService from "@/services/fileService";
import { formatFileSize, formatModifiedDate } from "@/lib/fileTypes";
import { isDesktopApp } from "@/services/transport";
import { FileQuestion, FileCode, Download, FolderOpen, ExternalLink, Code } from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

// Helper functions for desktop file operations
async function revealInFinder(path: string) {
  if (!isDesktopApp()) return;
  try {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
  } catch (err) {
    console.error("Failed to reveal in finder:", err);
  }
}

async function openWithDefaultApp(path: string) {
  if (!isDesktopApp()) return;
  try {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
  } catch (err) {
    console.error("Failed to open file:", err);
  }
}

// Image viewer for desktop
function ImageViewer({ file }: { file: OpenFile }) {
  const dataUrl = useMemo(() => {
    if (!file.content) return null;
    const mimeType = file.mimeType || "image/png";
    return `data:${mimeType};base64,${file.content}`;
  }, [file.content, file.mimeType]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [dataUrl, file.name]);

  if (!dataUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Unable to load image</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {file.name} • {formatFileSize(file.size)}
        </span>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
      {/* Image display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-muted/50">
        <img
          src={dataUrl}
          alt={file.name}
          className="max-w-full max-h-full object-contain shadow-lg"
          style={{ imageRendering: "auto" }}
        />
      </div>
    </div>
  );
}

// PDF viewer for desktop
function PdfViewer({ file }: { file: OpenFile }) {
  const dataUrl = useMemo(() => {
    if (!file.content) return null;
    return `data:application/pdf;base64,${file.content}`;
  }, [file.content]);

  const handleDownload = useCallback(() => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [dataUrl, file.name]);

  if (!dataUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Unable to load PDF</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {file.name} • {formatFileSize(file.size)}
        </span>
        <Button variant="ghost" size="sm" onClick={handleDownload}>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
      {/* PDF display */}
      <iframe
        src={dataUrl}
        className="flex-1 w-full border-0"
        title={file.name}
      />
    </div>
  );
}

// HTML preview viewer using iframe for safety and isolation
function HtmlPreviewViewer({ file, onToggleView }: { file: OpenFile; onToggleView: () => void }) {
  const srcDoc = useMemo(() => {
    if (!file.content) return "";
    return file.content;
  }, [file.content]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {file.name} • {formatFileSize(file.size)}
        </span>
        <Button variant="ghost" size="sm" onClick={onToggleView}>
          <Code className="w-4 h-4 mr-2" />
          View Source
        </Button>
      </div>
      {/* HTML preview in iframe */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
        <iframe
          srcDoc={srcDoc}
          title={`Preview of ${file.name}`}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}

// Markdown preview viewer
function MarkdownPreviewViewer({ file, onToggleView }: { file: OpenFile; onToggleView: () => void }) {
  const isDark = useIsDarkMode();
  const content = useMemo(() => {
    if (!file.content) return "";
    return file.content;
  }, [file.content]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">
          {file.name} • {formatFileSize(file.size)}
        </span>
        <Button variant="ghost" size="sm" onClick={onToggleView}>
          <Code className="w-4 h-4 mr-2" />
          View Source
        </Button>
      </div>
      {/* Markdown preview */}
      <div className="flex-1 overflow-auto p-6 bg-background">
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const isInline = !match && !className;

                if (isInline) {
                  return (
                    <code {...props}>
                      {children}
                    </code>
                  );
                }

                return (
                  <SyntaxHighlighter
                    style={isDark ? oneDark : oneLight}
                    language={match?.[1] || "text"}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                    }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                );
              },
              a({ children, href, ...props }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto">
                    <table {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// Binary file info viewer for desktop
function BinaryViewer({ file, onForceEdit }: { file: OpenFile; onForceEdit: () => void }) {
  const isDesktop = isDesktopApp();

  const handleDownload = useCallback(async () => {
    try {
      // Read file as binary for download
      const result = await fileService.readFileBinary(file.path);
      const byteString = atob(result.content);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: file.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  }, [file.path, file.name, file.mimeType]);

  const handleRevealInFinder = useCallback(() => {
    revealInFinder(file.path);
  }, [file.path]);

  const handleOpenWithDefaultApp = useCallback(() => {
    openWithDefaultApp(file.path);
  }, [file.path]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <FileQuestion className="w-20 h-20 text-muted-foreground/40 mb-6" />
      <h3 className="text-xl font-medium mb-2">{file.name}</h3>
      <p className="text-muted-foreground mb-6">
        This file type cannot be previewed as text
      </p>

      <div className="bg-muted rounded-lg p-6 w-full max-w-md mb-8">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-left">
            <span className="text-muted-foreground">File Size</span>
            <p className="font-medium">{formatFileSize(file.size)}</p>
          </div>
          <div className="text-left">
            <span className="text-muted-foreground">Last Modified</span>
            <p className="font-medium">{formatModifiedDate(file.modified)}</p>
          </div>
          <div className="text-left col-span-2">
            <span className="text-muted-foreground">MIME Type</span>
            <p className="font-medium">{file.mimeType || "Unknown"}</p>
          </div>
          <div className="text-left col-span-2">
            <span className="text-muted-foreground">Path</span>
            <p className="font-medium text-xs truncate">{file.path}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap justify-center">
        {isDesktop ? (
          <>
            <Button variant="outline" onClick={handleRevealInFinder}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Reveal in Finder
            </Button>
            <Button variant="outline" onClick={handleOpenWithDefaultApp}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
        <Button variant="secondary" onClick={onForceEdit}>
          <FileCode className="w-4 h-4 mr-2" />
          Force Edit as Text
        </Button>
      </div>
    </div>
  );
}

export function FileViewer() {
  const activeFile = useActiveFile();
  const updateFileContent = useFileStore((state) => state.updateFileContent);
  const [forceTextEdit, setForceTextEdit] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<Record<string, boolean>>({});

  const handleForceEdit = useCallback(async () => {
    if (!activeFile) return;
    try {
      const result = await fileService.readFile(activeFile.path);
      updateFileContent(activeFile.path, result.content);
      setForceTextEdit(activeFile.path);
    } catch (error) {
      console.error("Failed to read file as text:", error);
    }
  }, [activeFile, updateFileContent]);

  const togglePreview = useCallback(() => {
    if (!activeFile) return;
    setPreviewMode((prev) => ({
      ...prev,
      [activeFile.path]: !prev[activeFile.path],
    }));
  }, [activeFile]);

  // Helper to check if file is HTML or Markdown
  const getFileExtension = useCallback((path: string): string => {
    const name = path.split("/").pop() || "";
    return name.split(".").pop()?.toLowerCase() || "";
  }, []);

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

  const fileType = activeFile.fileType || "text";
  const isForceEditing = forceTextEdit === activeFile.path;
  const ext = getFileExtension(activeFile.path);
  const isHtml = ext === "html" || ext === "htm" || ext === "xhtml";
  const isMarkdown = ext === "md" || ext === "markdown" || ext === "mdx";

  // Default to preview mode for HTML/Markdown files (unless explicitly toggled off)
  const shouldShowPreview = previewMode[activeFile.path] !== undefined
    ? previewMode[activeFile.path]
    : (isHtml || isMarkdown);

  // HTML preview mode (default for HTML files)
  if (shouldShowPreview && isHtml) {
    return <HtmlPreviewViewer file={activeFile} onToggleView={togglePreview} />;
  }

  // Markdown preview mode (default for Markdown files)
  if (shouldShowPreview && isMarkdown) {
    return <MarkdownPreviewViewer file={activeFile} onToggleView={togglePreview} />;
  }

  // Text files or force editing - use Monaco editor (with preview toggle for HTML/MD)
  if (isForceEditing || fileType === "text") {
    return <CodeEditor onTogglePreview={(isHtml || isMarkdown) ? togglePreview : undefined} />;
  }

  // Image files
  if (fileType === "image") {
    return <ImageViewer file={activeFile} />;
  }

  // PDF files
  if (fileType === "pdf") {
    return <PdfViewer file={activeFile} />;
  }

  // Binary/unknown files
  return <BinaryViewer file={activeFile} onForceEdit={handleForceEdit} />;
}
