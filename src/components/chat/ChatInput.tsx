import { useState, useCallback, useRef, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  disabled: boolean;
}

export function ChatInput({
  onSend,
  onCancel,
  isLoading,
  disabled,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const isComposingRef = useRef(false);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed && !isLoading && !disabled) {
      onSend(trimmed);
      setInput("");
    }
  }, [input, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Check both e.isComposing (native) and isComposingRef (manual tracking for webkit)
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isComposingRef.current) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    // Delay reset to ensure keydown event has been processed
    setTimeout(() => {
      isComposingRef.current = false;
    }, 0);
  }, []);

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-4xl mx-auto flex gap-2">
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              disabled
                ? t("chat.connectToChat")
                : t("chat.placeholder")
            }
            disabled={disabled || isLoading}
            className="w-full min-h-[44px] max-h-32 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
          />
        </div>
        {isLoading ? (
          <Button
            onClick={onCancel}
            variant="destructive"
            size="icon"
            className="flex-shrink-0"
          >
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
