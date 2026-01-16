import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Message, ChatItem } from "@/types/acp";
import { ToolCallCard } from "./ToolCallCard";
import { Bot, User, Copy, Check, ArrowDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useIsDarkMode } from "@/hooks/useIsDarkMode";

interface MessageListProps {
  chatItems: ChatItem[];
  isLoading: boolean;
  onAskUserQuestionSubmit?: (toolCallId: string, answers: Record<string, string | string[]>) => void;
  askUserQuestionSubmitting?: string | null; // toolCallId that is submitting
}

export function MessageList({
  chatItems,
  isLoading,
  onAskUserQuestionSubmit,
  askUserQuestionSubmitting,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);

  // Check if scrolled to bottom (with some tolerance)
  const checkIfAtBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;

    const threshold = 100; // pixels from bottom
    const isBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    return isBottom;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
    setIsAtBottom(true);
    setShowScrollButton(false);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const wasScrollingUp = currentScrollTop < lastScrollTopRef.current;
    lastScrollTopRef.current = currentScrollTop;

    const atBottom = checkIfAtBottom();

    // If user scrolled up, mark as user scrolling
    if (wasScrollingUp && !atBottom) {
      isUserScrollingRef.current = true;
    }

    // If at bottom, reset user scrolling flag
    if (atBottom) {
      isUserScrollingRef.current = false;
    }

    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom);
  }, [checkIfAtBottom]);

  // Auto-scroll when new messages arrive (only if at bottom)
  useEffect(() => {
    if (isAtBottom && !isUserScrollingRef.current) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [chatItems, isAtBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  // Check if the last item is an assistant message (for loading indicator)
  const lastItem = chatItems[chatItems.length - 1];
  const lastIsAssistantMessage =
    lastItem?.type === "message" && lastItem.message.role === "assistant";

  return (
    <div className="h-full relative overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="absolute inset-0 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        <div className="space-y-2 max-w-4xl mx-auto">
          {chatItems.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg">{t("chat.startConversation")}</p>
              <p className="text-sm">{t("chat.typeMessage")}</p>
            </div>
          )}

          {chatItems.map((item) => {
            if (item.type === "message") {
              return <MessageBubble key={item.message.id} message={item.message} />;
            } else {
              return (
                <ToolCallCard
                  key={item.toolCall.toolCallId}
                  toolCall={item.toolCall}
                  onAskUserQuestionSubmit={onAskUserQuestionSubmit}
                  isAskUserQuestionSubmitting={askUserQuestionSubmitting === item.toolCall.toolCallId}
                />
              );
            }
          })}

          {isLoading && !lastIsAssistantMessage && (
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 bg-muted rounded-lg p-3">
                <div className="flex space-x-1">
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 right-4 rounded-full shadow-lg h-10 w-10 z-10"
          onClick={() => scrollToBottom(true)}
        >
          <ArrowDown className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isDark = useIsDarkMode();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [message.content]);

  return (
    <div
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-blue-500 dark:bg-blue-600/80 text-white" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4 text-primary" />
        )}
      </div>
      <div
        className={cn(
          "relative flex-1 max-w-[80%] rounded-lg px-2.5 py-1.5 group shadow-sm",
          isUser
            ? "bg-blue-500 dark:bg-blue-600/80 text-white"
            : "bg-card text-card-foreground border border-border"
        )}
      >
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded-md transition-all z-10",
            isHovered ? "opacity-100" : "opacity-0",
            isUser
              ? "hover:bg-white/20 text-white"
              : "hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
          )}
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>

        {/* Message content with markdown */}
        <div className={cn(
          "prose-custom text-sm pr-6 max-w-none",
          isUser && "prose-user"
        )}>
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
                      background: isDark
                        ? "hsl(220, 13%, 12%)"
                        : "hsl(220, 13%, 18%)",
                    }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                );
              },
              // Links use CSS variables
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
              // Tables use CSS variables
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto">
                    <table {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
              th({ children, ...props }) {
                return (
                  <th {...props}>
                    {children}
                  </th>
                );
              },
              td({ children, ...props }) {
                return (
                  <td {...props}>
                    {children}
                  </td>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
