import { useState } from "react";
import { useSettingsStore, type PermissionRule } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Shield, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";

const ACTION_CONFIG = {
  allow: { icon: ShieldCheck, label: "Allow", className: "text-green-500" },
  deny: { icon: ShieldAlert, label: "Deny", className: "text-red-500" },
  ask: { icon: ShieldQuestion, label: "Ask", className: "text-yellow-500" },
};

export function PermissionSettings() {
  const permissionRules = useSettingsStore((state) => state.permissionRules);
  const addPermissionRule = useSettingsStore((state) => state.addPermissionRule);
  const removePermissionRule = useSettingsStore((state) => state.removePermissionRule);
  const togglePermissionRule = useSettingsStore((state) => state.togglePermissionRule);

  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState<Partial<PermissionRule>>({
    name: "",
    toolPattern: "",
    pathPattern: "",
    action: "ask",
    enabled: true,
  });

  const handleAddRule = () => {
    if (newRule.name && newRule.toolPattern) {
      addPermissionRule({
        name: newRule.name,
        toolPattern: newRule.toolPattern,
        pathPattern: newRule.pathPattern || undefined,
        action: newRule.action as "allow" | "deny" | "ask",
        enabled: true,
      });
      setNewRule({ name: "", toolPattern: "", pathPattern: "", action: "ask", enabled: true });
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Permission Rules</h3>
        <p className="text-sm text-muted-foreground">
          Configure automatic permission rules for tool calls.
        </p>
      </div>

      <div className="space-y-3">
        {permissionRules.map((rule) => {
          const ActionIcon = ACTION_CONFIG[rule.action].icon;
          return (
            <div
              key={rule.id}
              className={`rounded-lg border p-4 ${
                !rule.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <ActionIcon
                    className={`w-5 h-5 mt-0.5 ${ACTION_CONFIG[rule.action].className}`}
                  />
                  <div className="space-y-1">
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Tool: <code className="bg-muted px-1 rounded">{rule.toolPattern}</code>
                      {rule.pathPattern && (
                        <>
                          {" "}| Path: <code className="bg-muted px-1 rounded">{rule.pathPattern}</code>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => togglePermissionRule(rule.id)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removePermissionRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isAdding ? (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">New Permission Rule</span>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Allow file reads"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tool-pattern">Tool Pattern (regex)</Label>
              <Input
                id="tool-pattern"
                placeholder="e.g., Read|Glob"
                value={newRule.toolPattern}
                onChange={(e) => setNewRule({ ...newRule, toolPattern: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="path-pattern">Path Pattern (optional, regex)</Label>
              <Input
                id="path-pattern"
                placeholder="e.g., /home/user/.*"
                value={newRule.pathPattern}
                onChange={(e) => setNewRule({ ...newRule, pathPattern: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Action</Label>
              <div className="flex gap-2">
                {(["allow", "deny", "ask"] as const).map((action) => {
                  const ActionIcon = ACTION_CONFIG[action].icon;
                  return (
                    <button
                      key={action}
                      onClick={() => setNewRule({ ...newRule, action })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        newRule.action === action
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      <ActionIcon className="w-4 h-4" />
                      {ACTION_CONFIG[action].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={!newRule.name || !newRule.toolPattern}>
              Add Rule
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Permission Rule
        </Button>
      )}

      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          <strong>Note:</strong> Rules are evaluated in order. The first matching rule determines the action.
          Use regex patterns for tool and path matching.
        </p>
      </div>
    </div>
  );
}
