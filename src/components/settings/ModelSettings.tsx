import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getTransport } from "@/services/transport";
import type { WebSocketTransport } from "@/services/transport/websocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Loader2,
  Info,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";
import type {
  ModelProviderConfig,
  CustomProvider,
  AnthropicProvider,
  BedrockProvider,
  BigModelProvider,
  MiniMaxProvider,
  MoonshotProvider,
  OllamaProvider,
} from "@/types/models";
import {
  createDefaultModelConfig,
  createCustomProvider,
  ANTHROPIC_MODELS,
  BEDROCK_MODELS,
  MINIMAX_MODELS,
  MOONSHOT_MODELS,
  AWS_REGIONS,
  PROVIDER_NAMES,
} from "@/types/models";

type BuiltInProviderKey = 'default' | 'anthropic' | 'bedrock' | 'bigmodel' | 'minimax' | 'moonshot' | 'ollama';

export function ModelSettings() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<ModelProviderConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newCustomName, setNewCustomName] = useState("");
  const [customRegion, setCustomRegion] = useState(false);
  const [customBedrockModel, setCustomBedrockModel] = useState(false);
  const [customMinimaxModel, setCustomMinimaxModel] = useState(false);
  const [customMoonshotModel, setCustomMoonshotModel] = useState(false);
  const [customAuthType, setCustomAuthType] = useState<Record<string, 'apiKey' | 'authToken'>>({});

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const transport = getTransport() as WebSocketTransport;
      const result = await transport.request<ModelProviderConfig>("get_model_config");
      setConfig(result);
      setOriginalConfig(JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
      // Use default config on error
      const defaultConfig = createDefaultModelConfig();
      setConfig(defaultConfig);
      setOriginalConfig(JSON.stringify(defaultConfig));
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = useCallback(async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    try {
      const transport = getTransport() as WebSocketTransport;
      await transport.request("set_model_config", config);
      setOriginalConfig(JSON.stringify(config));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }, [config]);

  // Check if config has been modified
  const hasChanges = config ? JSON.stringify(config) !== originalConfig : false;

  const handleProviderChange = (provider: string) => {
    if (!config) return;
    setConfig({ ...config, activeProvider: provider });
  };

  const handleAnthropicChange = (field: keyof AnthropicProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        anthropic: {
          ...config.providers.anthropic,
          [field]: value,
        },
      },
    });
  };

  const handleBedrockChange = (field: keyof BedrockProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        bedrock: {
          ...config.providers.bedrock,
          [field]: value,
        },
      },
    });
  };

  const handleBigModelChange = (field: keyof BigModelProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        bigmodel: {
          ...config.providers.bigmodel,
          [field]: value,
        },
      },
    });
  };

  const handleMiniMaxChange = (field: keyof MiniMaxProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        minimax: {
          ...config.providers.minimax,
          [field]: value,
        },
      },
    });
  };

  const handleMoonshotChange = (field: keyof MoonshotProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        moonshot: {
          ...config.providers.moonshot,
          [field]: value,
        },
      },
    });
  };

  const handleOllamaChange = (field: keyof OllamaProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      providers: {
        ...config.providers,
        ollama: {
          ...config.providers.ollama,
          [field]: value,
        },
      },
    });
  };

  const handleCustomProviderChange = (id: string, field: keyof CustomProvider, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      customProviders: config.customProviders.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    });
  };

  const addCustomProvider = () => {
    if (!config || !newCustomName.trim()) return;
    const id = `custom-${Date.now()}`;
    setConfig({
      ...config,
      customProviders: [
        ...config.customProviders,
        createCustomProvider(id, newCustomName.trim()),
      ],
      activeProvider: id, // Auto-select the new provider
    });
    setNewCustomName("");
  };

  const removeCustomProvider = (id: string) => {
    if (!config) return;
    setConfig({
      ...config,
      customProviders: config.customProviders.filter((p) => p.id !== id),
      // If removing active provider, switch to default
      activeProvider: config.activeProvider === id ? "default" : config.activeProvider,
    });
  };

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAdvanced = (key: string) => {
    setShowAdvanced((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div className="text-sm text-destructive">
            {error || "Failed to load model configuration"}
          </div>
        </div>
      </div>
    );
  }

  const builtInProviders: BuiltInProviderKey[] = ['default', 'anthropic', 'bedrock', 'bigmodel', 'minimax', 'moonshot', 'ollama'];

  // Render inline config for each provider
  const renderProviderConfig = (key: string) => {
    if (config.activeProvider !== key) return null;

    switch (key) {
      case "anthropic":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">{t("modelProvider.model")}</Label>
              <Select
                value={config.providers.anthropic.model}
                onValueChange={(v) => handleAnthropicChange("model", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANTHROPIC_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.providers.anthropic.model === "custom" && (
              <div>
                <Label className="text-xs">{t("modelProvider.customModel")}</Label>
                <Input
                  className="h-8 text-sm"
                  value={config.providers.anthropic.model}
                  onChange={(e) => handleAnthropicChange("model", e.target.value)}
                  placeholder="claude-sonnet-4-5"
                />
              </div>
            )}

            <div>
              <Label className="text-xs">{t("modelProvider.apiKey")}</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["anthropic-key"] ? "text" : "password"}
                  value={config.providers.anthropic.apiKey}
                  onChange={(e) => handleAnthropicChange("apiKey", e.target.value)}
                  placeholder="sk-ant-..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("anthropic-key")}
                >
                  {showSecrets["anthropic-key"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {t("modelProvider.apiKeyOr")} ANTHROPIC_AUTH_TOKEN
              </p>
            </div>

            <div>
              <Label className="text-xs">{t("modelProvider.baseUrl")} ({t("common.options")})</Label>
              <Input
                className="h-8 text-sm"
                value={config.providers.anthropic.baseUrl}
                onChange={(e) => handleAnthropicChange("baseUrl", e.target.value)}
                placeholder="https://api.anthropic.com"
              />
            </div>

            {/* Advanced Settings */}
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleAdvanced("anthropic")}
            >
              {showAdvanced["anthropic"] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {t("modelProvider.advancedSettings")}
            </button>

            {showAdvanced["anthropic"] && (
              <div className="space-y-2 pl-3 border-l-2 border-muted">
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_OPUS_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.anthropic.opusModel}
                    onChange={(e) => handleAnthropicChange("opusModel", e.target.value)}
                    placeholder="claude-opus-4-5"
                  />
                </div>
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_SONNET_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.anthropic.sonnetModel}
                    onChange={(e) => handleAnthropicChange("sonnetModel", e.target.value)}
                    placeholder="claude-sonnet-4-5"
                  />
                </div>
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_HAIKU_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.anthropic.haikuModel}
                    onChange={(e) => handleAnthropicChange("haikuModel", e.target.value)}
                    placeholder="claude-haiku-4-5"
                  />
                </div>
                <div>
                  <Label className="text-xs">CLAUDE_CODE_SUBAGENT_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.anthropic.subagentModel}
                    onChange={(e) => handleAnthropicChange("subagentModel", e.target.value)}
                    placeholder="claude-sonnet-4-5"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case "bedrock":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">{t("modelProvider.region")}</Label>
              {!customRegion && !AWS_REGIONS.some(r => r.id === config.providers.bedrock.region) ? (
                // Show input if current value is not in predefined list
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.region}
                    onChange={(e) => handleBedrockChange("region", e.target.value)}
                    placeholder="us-east-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCustomRegion(false);
                      handleBedrockChange("region", "us-east-1");
                    }}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : customRegion ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.region}
                    onChange={(e) => handleBedrockChange("region", e.target.value)}
                    placeholder="us-east-1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomRegion(false)}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={config.providers.bedrock.region}
                    onValueChange={(v) => handleBedrockChange("region", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AWS_REGIONS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomRegion(true)}
                  >
                    Custom
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">{t("modelProvider.model")}</Label>
              {!customBedrockModel && !BEDROCK_MODELS.some(m => m.id === config.providers.bedrock.model) ? (
                // Show input if current value is not in predefined list
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.model}
                    onChange={(e) => handleBedrockChange("model", e.target.value)}
                    placeholder="global.anthropic.claude-..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCustomBedrockModel(false);
                      handleBedrockChange("model", BEDROCK_MODELS[1].id);
                    }}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : customBedrockModel ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.model}
                    onChange={(e) => handleBedrockChange("model", e.target.value)}
                    placeholder="global.anthropic.claude-..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomBedrockModel(false)}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={config.providers.bedrock.model}
                    onValueChange={(v) => handleBedrockChange("model", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BEDROCK_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomBedrockModel(true)}
                  >
                    Custom
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">AWS_BEARER_TOKEN_BEDROCK</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["bedrock-token"] ? "text" : "password"}
                  value={config.providers.bedrock.bearerToken}
                  onChange={(e) => handleBedrockChange("bearerToken", e.target.value)}
                  placeholder="Bearer token..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("bedrock-token")}
                >
                  {showSecrets["bedrock-token"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Advanced Settings */}
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => toggleAdvanced("bedrock")}
            >
              {showAdvanced["bedrock"] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              {t("modelProvider.advancedSettings")}
            </button>

            {showAdvanced["bedrock"] && (
              <div className="space-y-2 pl-3 border-l-2 border-muted">
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_OPUS_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.opusModel}
                    onChange={(e) => handleBedrockChange("opusModel", e.target.value)}
                    placeholder="global.anthropic.claude-opus-..."
                  />
                </div>
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_SONNET_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.sonnetModel}
                    onChange={(e) => handleBedrockChange("sonnetModel", e.target.value)}
                    placeholder="global.anthropic.claude-sonnet-..."
                  />
                </div>
                <div>
                  <Label className="text-xs">ANTHROPIC_DEFAULT_HAIKU_MODEL</Label>
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.bedrock.haikuModel}
                    onChange={(e) => handleBedrockChange("haikuModel", e.target.value)}
                    placeholder="global.anthropic.claude-haiku-..."
                  />
                </div>
              </div>
            )}
          </div>
        );

      case "bigmodel":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">ANTHROPIC_AUTH_TOKEN</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["bigmodel-token"] ? "text" : "password"}
                  value={config.providers.bigmodel.authToken}
                  onChange={(e) => handleBigModelChange("authToken", e.target.value)}
                  placeholder="Auth token..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("bigmodel-token")}
                >
                  {showSecrets["bigmodel-token"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Base URL: https://open.bigmodel.cn/api/anthropic
            </div>
          </div>
        );

      case "minimax":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">{t("modelProvider.model")}</Label>
              {!customMinimaxModel && !MINIMAX_MODELS.some(m => m.id === config.providers.minimax.model) ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.minimax.model}
                    onChange={(e) => handleMiniMaxChange("model", e.target.value)}
                    placeholder="MiniMax-M2.1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCustomMinimaxModel(false);
                      handleMiniMaxChange("model", MINIMAX_MODELS[0].id);
                    }}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : customMinimaxModel ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.minimax.model}
                    onChange={(e) => handleMiniMaxChange("model", e.target.value)}
                    placeholder="MiniMax-M2.1"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomMinimaxModel(false)}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={config.providers.minimax.model}
                    onValueChange={(v) => handleMiniMaxChange("model", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MINIMAX_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomMinimaxModel(true)}
                  >
                    Custom
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">ANTHROPIC_AUTH_TOKEN</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["minimax-token"] ? "text" : "password"}
                  value={config.providers.minimax.authToken}
                  onChange={(e) => handleMiniMaxChange("authToken", e.target.value)}
                  placeholder="Auth token..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("minimax-token")}
                >
                  {showSecrets["minimax-token"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Base URL: https://api.minimax.io/anthropic
            </div>
          </div>
        );

      case "moonshot":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">{t("modelProvider.model")}</Label>
              {!customMoonshotModel && !MOONSHOT_MODELS.some(m => m.id === config.providers.moonshot.model) ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.moonshot.model}
                    onChange={(e) => handleMoonshotChange("model", e.target.value)}
                    placeholder="kimi-k2-thinking-turbo"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setCustomMoonshotModel(false);
                      handleMoonshotChange("model", MOONSHOT_MODELS[0].id);
                    }}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : customMoonshotModel ? (
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-sm"
                    value={config.providers.moonshot.model}
                    onChange={(e) => handleMoonshotChange("model", e.target.value)}
                    placeholder="kimi-k2-thinking-turbo"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomMoonshotModel(false)}
                  >
                    {t("common.options")}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={config.providers.moonshot.model}
                    onValueChange={(v) => handleMoonshotChange("model", v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOONSHOT_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setCustomMoonshotModel(true)}
                  >
                    Custom
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">ANTHROPIC_AUTH_TOKEN</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["moonshot-token"] ? "text" : "password"}
                  value={config.providers.moonshot.authToken}
                  onChange={(e) => handleMoonshotChange("authToken", e.target.value)}
                  placeholder="Your Moonshot API Key..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("moonshot-token")}
                >
                  {showSecrets["moonshot-token"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Base URL: https://api.moonshot.ai/anthropic
            </div>
          </div>
        );

      case "ollama":
        return (
          <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <Label className="text-xs">ANTHROPIC_MODEL</Label>
              <Input
                className="h-8 text-sm"
                value={config.providers.ollama.model}
                onChange={(e) => handleOllamaChange("model", e.target.value)}
                placeholder="qwen3:32b"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("modelProvider.ollamaModelHint")}
              </p>
            </div>

            <div>
              <Label className="text-xs">ANTHROPIC_BASE_URL</Label>
              <Input
                className="h-8 text-sm"
                value={config.providers.ollama.baseUrl}
                onChange={(e) => handleOllamaChange("baseUrl", e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>

            <div>
              <Label className="text-xs">ANTHROPIC_API_KEY ({t("common.optional")})</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm"
                  type={showSecrets["ollama-key"] ? "text" : "password"}
                  value={config.providers.ollama.apiKey}
                  onChange={(e) => handleOllamaChange("apiKey", e.target.value)}
                  placeholder="sk-..."
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleSecretVisibility("ollama-key")}
                >
                  {showSecrets["ollama-key"] ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {t("modelProvider.ollamaDescription")}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderCustomProviderConfig = (custom: CustomProvider) => {
    if (config.activeProvider !== custom.id) return null;

    // Determine current auth type based on which field has value
    const currentAuthType = customAuthType[custom.id] ||
      (custom.authToken ? 'authToken' : 'apiKey');

    return (
      <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <Label className="text-xs">{t("modelProvider.providerName")}</Label>
          <Input
            className="h-8 text-sm"
            value={custom.name}
            onChange={(e) => handleCustomProviderChange(custom.id, "name", e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">ANTHROPIC_MODEL</Label>
          <Input
            className="h-8 text-sm"
            value={custom.model}
            onChange={(e) => handleCustomProviderChange(custom.id, "model", e.target.value)}
            placeholder="model-id"
          />
        </div>

        <div>
          <Label className="text-xs">ANTHROPIC_BASE_URL</Label>
          <Input
            className="h-8 text-sm"
            value={custom.baseUrl}
            onChange={(e) => handleCustomProviderChange(custom.id, "baseUrl", e.target.value)}
            placeholder="https://api.example.com"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              className={`text-xs px-2 py-0.5 rounded ${
                currentAuthType === 'apiKey'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                setCustomAuthType(prev => ({ ...prev, [custom.id]: 'apiKey' }));
                // Clear the other field when switching
                if (custom.authToken) {
                  handleCustomProviderChange(custom.id, "authToken", "");
                }
              }}
            >
              ANTHROPIC_API_KEY
            </button>
            <button
              type="button"
              className={`text-xs px-2 py-0.5 rounded ${
                currentAuthType === 'authToken'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => {
                setCustomAuthType(prev => ({ ...prev, [custom.id]: 'authToken' }));
                // Clear the other field when switching
                if (custom.apiKey) {
                  handleCustomProviderChange(custom.id, "apiKey", "");
                }
              }}
            >
              ANTHROPIC_AUTH_TOKEN
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              className="h-8 text-sm"
              type={showSecrets[`custom-${custom.id}`] ? "text" : "password"}
              value={currentAuthType === 'apiKey' ? custom.apiKey : custom.authToken}
              onChange={(e) => handleCustomProviderChange(
                custom.id,
                currentAuthType === 'apiKey' ? "apiKey" : "authToken",
                e.target.value
              )}
              placeholder={currentAuthType === 'apiKey' ? "sk-ant-..." : "Auth token..."}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => toggleSecretVisibility(`custom-${custom.id}`)}
            >
              {showSecrets[`custom-${custom.id}`] ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Advanced Settings */}
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => toggleAdvanced(custom.id)}
        >
          {showAdvanced[custom.id] ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          {t("modelProvider.advancedSettings")}
        </button>

        {showAdvanced[custom.id] && (
          <div className="space-y-2 pl-3 border-l-2 border-muted">
            <div>
              <Label className="text-xs">ANTHROPIC_DEFAULT_OPUS_MODEL</Label>
              <Input
                className="h-8 text-sm"
                value={custom.opusModel}
                onChange={(e) => handleCustomProviderChange(custom.id, "opusModel", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">ANTHROPIC_DEFAULT_SONNET_MODEL</Label>
              <Input
                className="h-8 text-sm"
                value={custom.sonnetModel}
                onChange={(e) => handleCustomProviderChange(custom.id, "sonnetModel", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">ANTHROPIC_DEFAULT_HAIKU_MODEL</Label>
              <Input
                className="h-8 text-sm"
                value={custom.haikuModel}
                onChange={(e) => handleCustomProviderChange(custom.id, "haikuModel", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">CLAUDE_CODE_SUBAGENT_MODEL</Label>
              <Input
                className="h-8 text-sm"
                value={custom.subagentModel}
                onChange={(e) => handleCustomProviderChange(custom.id, "subagentModel", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("modelProvider.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("modelProvider.description")}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="text-sm text-destructive">{error}</div>
          </div>
        </div>
      )}

      {/* Provider Selection with Inline Config */}
      <div className="space-y-2">
        {builtInProviders.map((key) => (
          <div
            key={key}
            className={`rounded-lg border cursor-pointer transition-colors ${
              config.activeProvider === key
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
            onClick={() => handleProviderChange(key)}
          >
            <div className="flex items-center gap-3 p-3">
              <input
                type="radio"
                name="provider"
                value={key}
                checked={config.activeProvider === key}
                onChange={() => handleProviderChange(key)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">{PROVIDER_NAMES[key]}</div>
                {key === "default" && (
                  <div className="text-xs text-muted-foreground">
                    {t("modelProvider.defaultDescription")}
                  </div>
                )}
              </div>
              {config.activeProvider === key && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
            {/* Inline config for this provider */}
            {config.activeProvider === key && key !== "default" && (
              <div className="px-3 pb-3">
                {renderProviderConfig(key)}
              </div>
            )}
          </div>
        ))}

        {/* Custom Providers */}
        {config.customProviders.map((custom) => (
          <div
            key={custom.id}
            className={`rounded-lg border cursor-pointer transition-colors ${
              config.activeProvider === custom.id
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/50"
            }`}
            onClick={() => handleProviderChange(custom.id)}
          >
            <div className="flex items-center gap-3 p-3">
              <input
                type="radio"
                name="provider"
                value={custom.id}
                checked={config.activeProvider === custom.id}
                onChange={() => handleProviderChange(custom.id)}
                className="w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-medium">{custom.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t("modelProvider.customProvider")}
                </div>
              </div>
              {config.activeProvider === custom.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomProvider(custom.id);
                }}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
            {/* Inline config for custom provider */}
            {config.activeProvider === custom.id && (
              <div className="px-3 pb-3">
                {renderCustomProviderConfig(custom)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Custom Provider */}
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex gap-2">
          <Input
            value={newCustomName}
            onChange={(e) => setNewCustomName(e.target.value)}
            placeholder={t("modelProvider.newProviderName")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addCustomProvider();
              }
            }}
          />
          <Button
            variant="outline"
            onClick={addCustomProvider}
            disabled={!newCustomName.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t("common.add")}
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-500 mb-1">
              {t("modelProvider.restartRequired")}
            </p>
            <p className="text-muted-foreground">
              {t("modelProvider.restartDescription")}
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveConfig}
          disabled={saving || !hasChanges}
          className={saved ? "bg-green-600 hover:bg-green-600" : ""}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("common.loading")}
            </>
          ) : saved ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t("common.success")}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t("common.save")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
