import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function GeneralSettings() {
  const autoConnect = useSettingsStore((state) => state.autoConnect);
  const showHiddenFiles = useSettingsStore((state) => state.showHiddenFiles);
  const theme = useSettingsStore((state) => state.theme);
  const autoCleanEmptySessions = useSettingsStore((state) => state.autoCleanEmptySessions);
  const setAutoConnect = useSettingsStore((state) => state.setAutoConnect);
  const setShowHiddenFiles = useSettingsStore((state) => state.setShowHiddenFiles);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoCleanEmptySessions = useSettingsStore((state) => state.setAutoCleanEmptySessions);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure general application behavior.
        </p>
      </div>

      <div className="space-y-4">
        {/* Auto Connect */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-connect" className="text-base">
              Auto Connect
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically connect to the agent when the app starts.
            </p>
          </div>
          <Switch
            id="auto-connect"
            checked={autoConnect}
            onCheckedChange={setAutoConnect}
          />
        </div>

        {/* Show Hidden Files */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="hidden-files" className="text-base">
              Show Hidden Files
            </Label>
            <p className="text-sm text-muted-foreground">
              Display hidden files and directories in the file tree.
            </p>
          </div>
          <Switch
            id="hidden-files"
            checked={showHiddenFiles}
            onCheckedChange={setShowHiddenFiles}
          />
        </div>

        {/* Auto Clean Empty Sessions */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="auto-clean-sessions" className="text-base">
              Auto Clean Empty Sessions
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically remove empty sessions when loading session list.
            </p>
          </div>
          <Switch
            id="auto-clean-sessions"
            checked={autoCleanEmptySessions}
            onCheckedChange={setAutoCleanEmptySessions}
          />
        </div>

        {/* Theme */}
        <div className="rounded-lg border p-4">
          <div className="space-y-0.5 mb-3">
            <Label className="text-base">Theme</Label>
            <p className="text-sm text-muted-foreground">
              Choose your preferred color theme.
            </p>
          </div>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  theme === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
