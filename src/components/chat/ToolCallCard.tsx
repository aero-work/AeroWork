import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ToolCall, ToolCallStatus, AskUserQuestionInput, TodoWriteInput } from "@/types/acp";
import { AskUserQuestionCard } from "./AskUserQuestionCard";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface ToolCallCardProps {
  toolCall: ToolCall;
  onAskUserQuestionSubmit?: (toolCallId: string, answers: Record<string, string | string[]>) => void;
  isAskUserQuestionSubmitting?: boolean;
}

const statusConfig: Record<
  ToolCallStatus,
  { icon: React.ComponentType<{ className?: string }>; className: string; label: string }
> = {
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
  in_progress: { icon: Loader2, className: "text-blue-500 animate-spin", label: "Running" },
  completed: { icon: CheckCircle, className: "text-green-500", label: "Completed" },
  failed: { icon: XCircle, className: "text-destructive", label: "Failed" },
};

// Helper to check if this is an AskUserQuestion tool call
function isAskUserQuestionToolCall(toolCall: ToolCall): AskUserQuestionInput | null {
  if (!toolCall.title?.includes("AskUserQuestion") && !toolCall.rawInput) {
    return null;
  }

  const input = toolCall.rawInput as AskUserQuestionInput | undefined;
  if (input?.questions && Array.isArray(input.questions)) {
    return input;
  }

  return null;
}

// Helper to check if this is a TodoWrite tool call
function isTodoWriteToolCall(toolCall: ToolCall): TodoWriteInput | null {
  if (!toolCall.title?.includes("TodoWrite")) {
    return null;
  }

  const input = toolCall.rawInput as TodoWriteInput | undefined;
  if (input?.todos && Array.isArray(input.todos)) {
    return input;
  }

  return null;
}

export function ToolCallCard({
  toolCall,
  onAskUserQuestionSubmit,
  isAskUserQuestionSubmitting,
}: ToolCallCardProps) {
  // All hooks must be called before any conditional returns
  const [isExpanded, setIsExpanded] = useState(false);

  const status = toolCall.status || "pending";
  const { icon: StatusIcon, className: statusClassName } = statusConfig[status];

  // Check if this is an AskUserQuestion tool call
  const askUserQuestionInput = useMemo(() => isAskUserQuestionToolCall(toolCall), [toolCall]);
  const isAskUserQuestion = askUserQuestionInput !== null;

  // Check if this is a TodoWrite tool call (don't show in message list, shown in TodoPanel)
  const isTodoWrite = useMemo(() => isTodoWriteToolCall(toolCall) !== null, [toolCall]);

  const hasContent =
    toolCall.rawInput != null ||
    (toolCall.content && toolCall.content.length > 0);

  // For AskUserQuestion, render the interactive card
  if (isAskUserQuestion && askUserQuestionInput && onAskUserQuestionSubmit) {
    // AskUserQuestion is only "answered" when there's actual output (user responded)
    // Just having status=completed from permission approval doesn't mean user answered
    const isAnswered = status === "completed" && toolCall.rawOutput != null;
    return (
      <AskUserQuestionCard
        toolCallId={toolCall.toolCallId}
        input={askUserQuestionInput}
        onSubmit={onAskUserQuestionSubmit}
        isSubmitting={isAskUserQuestionSubmitting}
        isAnswered={isAnswered}
      />
    );
  }

  // TodoWrite is displayed in TodoPanel, hide from message list
  if (isTodoWrite) {
    return null;
  }

  return (
    <div className="border rounded-lg bg-muted/30 overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2",
          hasContent && "cursor-pointer hover:bg-muted/50"
        )}
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
      >
        {hasContent && (
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        )}

        <span className="flex-1 text-sm font-medium truncate">
          {toolCall.title}
        </span>

        <StatusIcon className={cn("w-4 h-4", statusClassName)} />
      </div>

      {/* Expanded Content */}
      {isExpanded && hasContent && (
        <div className="border-t px-3 py-2 space-y-2">
          {/* Raw Input */}
          {toolCall.rawInput != null && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Input</div>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
                {typeof toolCall.rawInput === "string"
                  ? toolCall.rawInput
                  : JSON.stringify(toolCall.rawInput, null, 2)}
              </pre>
            </div>
          )}

          {/* Content/Output */}
          {toolCall.content && toolCall.content.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Output</div>
              <div className="space-y-1">
                {toolCall.content.map((item, index) => (
                  <div key={index}>
                    {item.type === "content" && "content" in item && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap">
                        {"text" in item.content
                          ? item.content.text.slice(0, 1000) + (item.content.text.length > 1000 ? "..." : "")
                          : "[Image]"}
                      </pre>
                    )}
                    {item.type === "diff" && (
                      <div className="text-xs bg-muted p-2 rounded font-mono">
                        <div className="text-muted-foreground mb-1">
                          {item.path}
                        </div>
                        <pre className="overflow-auto max-h-40 text-green-600 whitespace-pre-wrap">
                          {item.newText.slice(0, 1000) + (item.newText.length > 1000 ? "..." : "")}
                        </pre>
                      </div>
                    )}
                    {item.type === "terminal" && (
                      <div className="text-xs bg-zinc-900 text-green-400 p-2 rounded font-mono">
                        Terminal: {item.terminalId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locations */}
          {toolCall.locations && toolCall.locations.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">
                Locations
              </div>
              <div className="flex flex-wrap gap-1">
                {toolCall.locations.map((loc, index) => (
                  <span
                    key={index}
                    className="text-xs bg-muted px-2 py-0.5 rounded font-mono"
                  >
                    {loc.path}
                    {loc.line && `:${loc.line}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
