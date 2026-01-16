import { useRef, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SessionInfo, SessionStatus } from "@/types/acp";
import { useSessionData } from "@/hooks/useSessionData";
import { MessageSquare, Clock, Trash2, Square, Loader2, Check, AlertTriangle } from "lucide-react";

/** Get status badge styles based on session status */
function getStatusBadgeStyles(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "bg-blue-500/20 text-blue-600 dark:text-blue-400"; // Blue for running
    case "pending":
      return "bg-orange-500/20 text-orange-600 dark:text-orange-400"; // Orange for waiting
    case "idle":
      return "bg-green-500/20 text-green-600 dark:text-green-400"; // Green for ready
    case "stopped":
    default:
      return "bg-gray-500/20 text-gray-600 dark:text-gray-400"; // Gray for stopped
  }
}

/** Get status label translation key */
function getStatusLabelKey(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "session.status.running";
    case "pending":
      return "session.status.pending";
    case "idle":
      return "session.status.ready";
    case "stopped":
    default:
      return "session.status.stopped";
  }
}

interface SwipeableSessionCardProps {
  session: SessionInfo;
  isActive?: boolean;
  onClick: () => void;
  onDelete?: () => Promise<void> | void;
  onStop?: () => Promise<void> | void;
}

function formatRelativeTime(timestamp: string | number, t: (key: string, options?: Record<string, unknown>) => string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("time.justNow");
  if (diffMins < 60) return t("time.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  if (diffDays === 1) return t("time.yesterday");
  if (diffDays < 7) return t("time.daysAgo", { count: diffDays });

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Minimum swipe distance to trigger action
const SWIPE_THRESHOLD = 80;
// Width of delete button when fully revealed
const DELETE_WIDTH = 80;

/**
 * SwipeableSessionCard - iOS-style swipe to delete session card
 */
export function SwipeableSessionCard({
  session,
  isActive,
  onClick,
  onDelete,
  onStop,
}: SwipeableSessionCardProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [actionState, setActionState] = useState<"idle" | "loading" | "success">("idle");

  // Get Yolo mode from session state (only for active sessions)
  const { state: sessionState } = useSessionData(session.active ? session.id : null);
  const isYoloMode = sessionState?.dangerousMode ?? false;

  // Touch tracking
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  // Session title: use first user message, summary, or fallback
  const sessionTitle = session.lastUserMessage || session.summary || t("session.conversation");
  const timeStr = session.lastActivity ? formatRelativeTime(session.lastActivity, t) : "";

  // Reset state when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTranslateX(0);
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = touch.clientX;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - startX.current;
      const deltaY = touch.clientY - startY.current;

      // Determine swipe direction on first move
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
      }

      // Only handle horizontal swipes
      if (!isHorizontalSwipe.current) {
        return;
      }

      currentX.current = touch.clientX;

      // Calculate new position
      let newTranslate = deltaX;

      // If already open, adjust from the open position
      if (isOpen) {
        newTranslate = deltaX - DELETE_WIDTH;
      }

      // Limit swipe: can't swipe right past 0, can't swipe left past DELETE_WIDTH + some overflow
      newTranslate = Math.max(-DELETE_WIDTH - 20, Math.min(20, newTranslate));

      setTranslateX(newTranslate);
    },
    [isDragging, isOpen]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    isHorizontalSwipe.current = null;

    // Determine final state based on position
    if (translateX < -SWIPE_THRESHOLD) {
      // Reveal delete button
      setTranslateX(-DELETE_WIDTH);
      setIsOpen(true);
    } else {
      // Snap back to closed
      setTranslateX(0);
      setIsOpen(false);
    }
  }, [translateX]);

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      // If delete button is showing, tap to close
      if (isOpen) {
        e.preventDefault();
        setTranslateX(0);
        setIsOpen(false);
        return;
      }

      // Only trigger click if not dragging
      if (Math.abs(translateX) < 5) {
        onClick();
      }
    },
    [isOpen, translateX, onClick]
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onDelete && actionState === "idle") {
        setActionState("loading");
        try {
          await onDelete();
          setActionState("success");
          // Show success briefly then close
          setTimeout(() => {
            setTranslateX(0);
            setIsOpen(false);
            setActionState("idle");
          }, 300);
        } catch {
          setActionState("idle");
          setTranslateX(0);
          setIsOpen(false);
        }
      }
    },
    [onDelete, actionState]
  );

  const handleStop = useCallback(
    async (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onStop && actionState === "idle") {
        setActionState("loading");
        try {
          await onStop();
          setActionState("success");
          // Show success briefly then close
          setTimeout(() => {
            setTranslateX(0);
            setIsOpen(false);
            setActionState("idle");
          }, 300);
        } catch {
          setActionState("idle");
          setTranslateX(0);
          setIsOpen(false);
        }
      }
    },
    [onStop, actionState]
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Action button (behind the card) */}
      {/* Show stop button for active sessions (running/pending/idle), delete for stopped sessions */}
      {session.active ? (
        /* Stop button for active sessions (unload from memory) */
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 flex items-center justify-center text-white transition-colors",
            actionState === "success" ? "bg-green-500" : "bg-orange-500"
          )}
          style={{ width: DELETE_WIDTH }}
          onClick={handleStop}
          role="button"
          tabIndex={0}
        >
          {actionState === "loading" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : actionState === "success" ? (
            <Check className="w-6 h-6" />
          ) : (
            <Square className="w-6 h-6 fill-current" />
          )}
        </div>
      ) : (
        /* Delete button for stopped/inactive sessions */
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 flex items-center justify-center transition-colors",
            actionState === "success"
              ? "bg-green-500 text-white"
              : "bg-destructive text-destructive-foreground"
          )}
          style={{ width: DELETE_WIDTH }}
          onClick={handleDelete}
          role="button"
          tabIndex={0}
        >
          {actionState === "loading" ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : actionState === "success" ? (
            <Check className="w-6 h-6" />
          ) : (
            <Trash2 className="w-6 h-6" />
          )}
        </div>
      )}

      {/* Card content (swipeable) */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "w-full text-left p-4 border-b border-border transition-colors cursor-pointer bg-background relative",
          "active:bg-accent",
          isActive && "bg-accent border-l-2 border-l-primary",
          !isDragging && "transition-transform duration-200 ease-out"
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: "pan-y", // Allow vertical scroll, prevent horizontal default behavior
        }}
      >
        <div className="flex items-start gap-3">
          {/* Session icon */}
          <div
            className={cn(
              "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <MessageSquare className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header row: session title */}
            <div className="font-medium text-foreground mb-1">
              {truncateText(sessionTitle, 20)}
            </div>

            {/* Time + status row */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* Status badge */}
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full font-medium flex-shrink-0",
                  getStatusBadgeStyles(session.status)
                )}
              >
                {t(getStatusLabelKey(session.status))}
              </span>
              {/* Yolo mode indicator */}
              {isYoloMode && (
                <span className="flex items-center gap-0.5 text-yellow-500 font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  <span style={{ fontFamily: "Quantico, sans-serif", fontStyle: "italic" }}>Yolo</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
              {session.messageCount > 0 && (
                <span className="bg-muted px-1.5 py-0.5 rounded-full">
                  {t("session.messages", { count: session.messageCount })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
