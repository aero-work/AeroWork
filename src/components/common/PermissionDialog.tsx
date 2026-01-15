import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/stores/agentStore";
import { agentAPI } from "@/services/api";
import type { PermissionOptionKind } from "@/types/acp";
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";

const kindConfig: Record<
  PermissionOptionKind,
  {
    icon: React.ComponentType<{ className?: string }>;
    variant: "default" | "destructive" | "outline" | "secondary";
  }
> = {
  allow_once: { icon: ShieldCheck, variant: "default" },
  allow_always: { icon: Shield, variant: "secondary" },
  reject_once: { icon: ShieldX, variant: "outline" },
  reject_always: { icon: ShieldAlert, variant: "destructive" },
};

export function PermissionDialog() {
  const pendingPermission = useAgentStore((state) => state.pendingPermission);

  console.log("PermissionDialog render, pendingPermission:", pendingPermission);

  const handleOption = useCallback(
    (optionId: string) => {
      agentAPI.resolvePermission({ outcome: "selected", optionId });
    },
    []
  );

  const handleCancel = useCallback(() => {
    agentAPI.resolvePermission({ outcome: "cancelled" });
  }, []);

  if (!pendingPermission) return null;

  const { toolCall, options } = pendingPermission;

  return (
    <Dialog open={!!pendingPermission} onOpenChange={() => handleCancel()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <span className="truncate">Permission Required</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            The agent wants to perform the following action:
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="bg-muted rounded-lg p-2 sm:p-3">
            <p className="font-medium text-xs sm:text-sm break-words">
              {String(toolCall.title ?? "Unknown action")}
            </p>
            {toolCall.rawInput != null && (
              <pre className="mt-2 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {String(JSON.stringify(toolCall.rawInput, null, 2))}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 flex-wrap gap-1.5 sm:gap-2">
          {options.map((option) => {
            const { icon: Icon, variant } = kindConfig[option.kind];
            return (
              <Button
                key={option.optionId}
                variant={variant}
                size="sm"
                onClick={() => handleOption(option.optionId)}
                className="flex items-center gap-1.5 text-xs sm:text-sm"
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="truncate">{option.name}</span>
              </Button>
            );
          })}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
