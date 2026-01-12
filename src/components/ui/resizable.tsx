import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  side: "left" | "right";
  className?: string;
}

export function ResizablePanel({
  children,
  defaultSize = 240,
  minSize = 180,
  maxSize = 480,
  side,
  className,
}: ResizablePanelProps) {
  const [size, setSize] = React.useState(defaultSize);
  const [isResizing, setIsResizing] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = e.clientX;
      const startSize = size;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = side === "left" ? e.clientX - startX : startX - e.clientX;
        const newSize = Math.min(Math.max(startSize + delta, minSize), maxSize);
        setSize(newSize);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [size, minSize, maxSize, side]
  );

  return (
    <div
      ref={panelRef}
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size }}
    >
      {children}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 transition-colors z-10",
          side === "left" ? "right-0" : "left-0",
          isResizing && "bg-primary/30"
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

interface ResizableLayoutProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
  sidebarDefaultSize?: number;
  sidebarMinSize?: number;
  sidebarMaxSize?: number;
}

export function ResizableLayout({
  sidebar,
  main,
  sidebarDefaultSize = 240,
  sidebarMinSize = 180,
  sidebarMaxSize = 400,
}: ResizableLayoutProps) {
  return (
    <div className="flex h-full">
      <ResizablePanel
        side="left"
        defaultSize={sidebarDefaultSize}
        minSize={sidebarMinSize}
        maxSize={sidebarMaxSize}
        className="border-r"
      >
        {sidebar}
      </ResizablePanel>
      <div className="flex-1 min-w-0">{main}</div>
    </div>
  );
}

// Three-panel layout: sidebar | center | right panel
interface ThreePanelLayoutProps {
  sidebar: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  sidebarDefaultSize?: number;
  sidebarMinSize?: number;
  sidebarMaxSize?: number;
  rightDefaultSize?: number;
  rightMinSize?: number;
  rightMaxSize?: number;
}

export function ThreePanelLayout({
  sidebar,
  center,
  right,
  sidebarDefaultSize = 240,
  sidebarMinSize = 180,
  sidebarMaxSize = 400,
  rightDefaultSize = 500,
  rightMinSize = 300,
  rightMaxSize = 800,
}: ThreePanelLayoutProps) {
  return (
    <div className="flex h-full">
      {/* Sidebar (left) */}
      <ResizablePanel
        side="left"
        defaultSize={sidebarDefaultSize}
        minSize={sidebarMinSize}
        maxSize={sidebarMaxSize}
        className="border-r"
      >
        {sidebar}
      </ResizablePanel>

      {/* Center (chat) - flexible */}
      <div className="flex-1 min-w-[300px] border-r">{center}</div>

      {/* Right panel (editor) */}
      <ResizablePanel
        side="right"
        defaultSize={rightDefaultSize}
        minSize={rightMinSize}
        maxSize={rightMaxSize}
      >
        {right}
      </ResizablePanel>
    </div>
  );
}
