import { useState } from "react";
import { useSettingsStore, type MCPServer } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Server, Terminal, AlertCircle } from "lucide-react";

export function MCPSettings() {
  const mcpServers = useSettingsStore((state) => state.mcpServers);
  const addMCPServer = useSettingsStore((state) => state.addMCPServer);
  const removeMCPServer = useSettingsStore((state) => state.removeMCPServer);
  const toggleMCPServer = useSettingsStore((state) => state.toggleMCPServer);

  const [isAdding, setIsAdding] = useState(false);
  const [newServer, setNewServer] = useState<Partial<MCPServer>>({
    name: "",
    command: "",
    args: [],
    enabled: true,
  });
  const [argsInput, setArgsInput] = useState("");

  const handleAddServer = () => {
    if (newServer.name && newServer.command) {
      addMCPServer({
        name: newServer.name,
        command: newServer.command,
        args: argsInput.split(" ").filter(Boolean),
        enabled: true,
      });
      setNewServer({ name: "", command: "", args: [], enabled: true });
      setArgsInput("");
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">MCP Servers</h3>
        <p className="text-sm text-muted-foreground">
          Configure Model Context Protocol servers to extend agent capabilities.
        </p>
      </div>

      {mcpServers.length === 0 && !isAdding ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Server className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h4 className="font-medium mb-2">No MCP Servers Configured</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Add MCP servers to extend the agent with custom tools and resources.
          </p>
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add MCP Server
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {mcpServers.map((server) => (
              <div
                key={server.id}
                className={`rounded-lg border p-4 ${
                  !server.enabled ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Server className="w-5 h-5 mt-0.5 text-primary" />
                    <div className="space-y-1">
                      <div className="font-medium">{server.name}</div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Terminal className="w-3 h-3" />
                        <code className="bg-muted px-1 rounded">
                          {server.command} {server.args.join(" ")}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={server.enabled}
                      onCheckedChange={() => toggleMCPServer(server.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMCPServer(server.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isAdding ? (
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">New MCP Server</span>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input
                    id="server-name"
                    placeholder="e.g., filesystem"
                    value={newServer.name}
                    onChange={(e) =>
                      setNewServer({ ...newServer, name: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="server-command">Command</Label>
                  <Input
                    id="server-command"
                    placeholder="e.g., npx"
                    value={newServer.command}
                    onChange={(e) =>
                      setNewServer({ ...newServer, command: e.target.value })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="server-args">Arguments (space-separated)</Label>
                  <Input
                    id="server-args"
                    placeholder="e.g., -y @modelcontextprotocol/server-filesystem /path"
                    value={argsInput}
                    onChange={(e) => setArgsInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddServer}
                  disabled={!newServer.name || !newServer.command}
                >
                  Add Server
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add MCP Server
            </Button>
          )}
        </>
      )}

      <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-500 mb-1">Work in Progress</p>
            <p className="text-muted-foreground">
              MCP server integration is under development. Configured servers will be
              passed to the agent when creating new sessions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
