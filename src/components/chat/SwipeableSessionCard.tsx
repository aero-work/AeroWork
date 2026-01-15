import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { SessionInfo, SessionStatus } from "@/types/acp";
import { MessageSquare, Clock, Trash2, Square } from "lucide-react";

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

/** Get status label text */
function getStatusLabel(status: SessionStatus): string {
  switch (status) {
    case "running":
      return "Running";
    case "pending":
      return "Pending";
    case "idle":
      return "Ready";
    case "stopped":
    default:
      return "Stopped";
  }
}

interface SwipeableSessionCardProps {
  session: SessionInfo;
  isActive?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onStop?: () => void;
}

function formatRelativeTime(timestamp: string | number): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Touch tracking
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  // Session title: use first user message, summary, or fallback
  const sessionTitle = session.lastUserMessage || session.summary || "New Conversation";
  const timeStr = session.lastActivity ? formatRelativeTime(session.lastActivity) : "";

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

      // Prevent vertical scrolling while swiping horizontally
      e.preventDefault();

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
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onDelete) {
        onDelete();
      }
      setTranslateX(0);
      setIsOpen(false);
    },
    [onDelete]
  );

  const handleStop = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onStop) {
        onStop();
      }
      setTranslateX(0);
      setIsOpen(false);
    },
    [onStop]
  );

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
    >
      {/* Action button (behind the card) */}
      {session.active ? (
        /* Stop button for active/running sessions */
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-orange-500 text-white"
          style={{ width: DELETE_WIDTH }}
          onClick={handleStop}
          role="button"
          tabIndex={0}
        >
          <Square className="w-6 h-6 fill-current" />
        </div>
      ) : (
        /* Delete button for inactive sessions */
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive text-destructive-foreground"
          style={{ width: DELETE_WIDTH }}
          onClick={handleDelete}
          role="button"
          tabIndex={0}
        >
          <Trash2 className="w-6 h-6" />
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
                {getStatusLabel(session.status)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
              {session.messageCount > 0 && (
                <span className="bg-muted px-1.5 py-0.5 rounded-full">
                  {session.messageCount} msgs
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
