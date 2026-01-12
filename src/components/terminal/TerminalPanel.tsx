import { useCallback } from "react";
import { Plus, X, ChevronDown, Terminal as TerminalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTerminalStore } from "@/stores/terminalStore";
import { useFileStore } from "@/stores/fileStore";
import { XTerminal } from "./XTerminal";

export function TerminalPanel() {
  const terminals = useTerminalStore((state) => state.terminals);
  const activeTerminalId = useTerminalStore((state) => state.activeTerminalId);
  const isTerminalPanelOpen = useTerminalStore((state) => state.isTerminalPanelOpen);
  const createTerminal = useTerminalStore((state) => state.createTerminal);
  const killTerminal = useTerminalStore((state) => state.killTerminal);
  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);
  const setTerminalPanelOpen = useTerminalStore((state) => state.setTerminalPanelOpen);
  const currentWorkingDir = useFileStore((state) => state.currentWorkingDir);

  const handleCreateTerminal = useCallback(async () => {
    const workingDir = currentWorkingDir || "/";
    // Default terminal size - will be resized by fit addon
    await createTerminal(workingDir, 80, 24);
  }, [createTerminal, currentWorkingDir]);

  const handleKillTerminal = useCallback(
    async (e: React.MouseEvent, terminalId: string) => {
      e.stopPropagation();
      await killTerminal(terminalId);
    },
    [killTerminal]
  );

  if (!isTerminalPanelOpen) {
    return null;
  }

  return (
    <div className="flex flex-col h-full border-t bg-background">
      {/* Terminal tabs header */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/50">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              role="tab"
              tabIndex={0}
              onClick={() => setActiveTerminal(terminal.id)}
              onKeyDown={(e) => e.key === "Enter" && setActiveTerminal(terminal.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs rounded-sm hover:bg-accent cursor-pointer",
                activeTerminalId === terminal.id && "bg-accent"
              )}
            >
              <TerminalIcon className="w-3 h-3" />
              <span className="truncate max-w-[100px]">
                {terminal.working_dir.split("/").pop() || "Terminal"}
              </span>
              <button
                onClick={(e) => handleKillTerminal(e, terminal.id)}
                className="hover:bg-destructive/20 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCreateTerminal}
            title="New Terminal"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setTerminalPanelOpen(false)}
            title="Hide Terminal"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0">
        {terminals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <TerminalIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No terminals open</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleCreateTerminal}
            >
              <Plus className="w-4 h-4 mr-1" />
              New Terminal
            </Button>
          </div>
        ) : (
          <div className="h-full">
            {terminals.map((terminal) => (
              <div
                key={terminal.id}
                className={cn(
                  "h-full",
                  activeTerminalId !== terminal.id && "hidden"
                )}
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
