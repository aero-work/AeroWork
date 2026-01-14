import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MCPSettings } from "./MCPSettings";
import { ModelSettings } from "./ModelSettings";
import { PermissionSettings } from "./PermissionSettings";
import { GeneralSettings } from "./GeneralSettings";
import { AgentSettings } from "./AgentSettings";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SettingsPage() {
  const activePanel = useSettingsStore((state) => state.activePanel);
  const closeSettings = useSettingsStore((state) => state.closeSettings);

  const renderContent = () => {
    switch (activePanel) {
      case "general":
        return <GeneralSettings />;
      case "agents":
        return <AgentSettings />;
      case "models":
        return <ModelSettings />;
      case "mcp":
        return <MCPSettings />;
      case "permissions":
        return <PermissionSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  const getPanelTitle = () => {
    switch (activePanel) {
      case "general":
        return "General Settings";
      case "agents":
        return "Agent Connection";
      case "models":
        return "Model Configuration";
      case "mcp":
        return "MCP Servers";
      case "permissions":
        return "Permission Rules";
      default:
        return "Settings";
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">{getPanelTitle()}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeSettings}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto">
          {renderContent()}
        </div>
      </ScrollArea>
    </div>
  );
}
