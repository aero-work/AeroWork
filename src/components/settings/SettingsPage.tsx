import { useSettingsStore, type SettingsPanel } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Settings2, Bot, Server, Shield, Puzzle } from "lucide-react";
import { MCPSettings } from "./MCPSettings";
import { ModelSettings } from "./ModelSettings";
import { PermissionSettings } from "./PermissionSettings";
import { GeneralSettings } from "./GeneralSettings";
import { AgentSettings } from "./AgentSettings";
import { PluginsSettings } from "./PluginsSettings";
import { ScrollArea } from "@/components/ui/scroll-area";

const PANEL_CONFIG: { id: SettingsPanel; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings2 className="w-4 h-4" /> },
  { id: "agents", label: "Agents", icon: <Bot className="w-4 h-4" /> },
  { id: "models", label: "Models", icon: <Bot className="w-4 h-4" /> },
  { id: "mcp", label: "MCP Servers", icon: <Server className="w-4 h-4" /> },
  { id: "plugins", label: "Plugins", icon: <Puzzle className="w-4 h-4" /> },
  { id: "permissions", label: "Permissions", icon: <Shield className="w-4 h-4" /> },
];

export function SettingsPage() {
  const activePanel = useSettingsStore((state) => state.activePanel);
  const setActivePanel = useSettingsStore((state) => state.setActivePanel);
  const closeSettings = useSettingsStore((state) => state.closeSettings);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Settings</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeSettings}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activePanel || "general"}
        onValueChange={(value) => setActivePanel(value as SettingsPanel)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="border-b px-4">
          <TabsList className="h-10 w-full justify-start gap-1 bg-transparent p-0">
            {PANEL_CONFIG.map((panel) => (
              <TabsTrigger
                key={panel.id}
                value={panel.id!}
                className="relative h-10 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <div className="flex items-center gap-2">
                  {panel.icon}
                  <span className="hidden sm:inline">{panel.label}</span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 max-w-2xl mx-auto">
            <TabsContent value="general" className="m-0 mt-0">
              <GeneralSettings />
            </TabsContent>

            <TabsContent value="agents" className="m-0 mt-0">
              <AgentSettings />
            </TabsContent>

            <TabsContent value="models" className="m-0 mt-0">
              <ModelSettings />
            </TabsContent>

            <TabsContent value="mcp" className="m-0 mt-0">
              <MCPSettings />
            </TabsContent>

            <TabsContent value="plugins" className="m-0 mt-0">
              <PluginsSettings />
            </TabsContent>

            <TabsContent value="permissions" className="m-0 mt-0">
              <PermissionSettings />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
