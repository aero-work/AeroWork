import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, Star, Trash2 } from "lucide-react";

export function ModelSettings() {
  const models = useSettingsStore((state) => state.models);
  const defaultModelId = useSettingsStore((state) => state.defaultModelId);
  const setDefaultModel = useSettingsStore((state) => state.setDefaultModel);
  const removeModel = useSettingsStore((state) => state.removeModel);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Model Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure AI models and select the default model for new sessions.
        </p>
      </div>

      <div className="space-y-3">
        {models.map((model) => (
          <div
            key={model.id}
            className={`flex items-center justify-between rounded-lg border p-4 ${
              model.id === defaultModelId ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {model.id === defaultModelId && (
                <Star className="w-4 h-4 text-primary fill-primary" />
              )}
              <div>
                <Label className="text-base font-medium">{model.name}</Label>
                <p className="text-sm text-muted-foreground">
                  Provider: {model.provider}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {model.id !== defaultModelId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDefaultModel(model.id)}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Set Default
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeModel(model.id)}
                disabled={models.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Model configuration is managed by the connected agent.
        </p>
        <p className="text-xs text-muted-foreground">
          The available models depend on your agent configuration and API keys.
        </p>
      </div>
    </div>
  );
}
