import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTransport } from "@/services/transport";
import { WebSocketTransport } from "@/services/transport/websocket";
import type {
  ListPluginsResponse,
  MarketplaceInfo,
  PluginInfo,
} from "@/types/plugins";
import {
  Plus,
  Trash2,
  RefreshCw,
  Package,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// Helper to open external URLs (works in both Tauri and browser)
async function openExternalUrl(url: string) {
  try {
    // Check if running in Tauri
    if ("__TAURI_INTERNALS__" in window) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } else {
      // Fallback for browser
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    console.error("Failed to open URL:", err);
    // Fallback
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function PluginsSettings() {
  const transport = useTransport();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListPluginsResponse | null>(null);
  const [expandedMarketplaces, setExpandedMarketplaces] = useState<Set<string>>(
    new Set()
  );

  // Add marketplace dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newMarketplaceName, setNewMarketplaceName] = useState("");
  const [newMarketplaceUrl, setNewMarketplaceUrl] = useState("");
  const [addingMarketplace, setAddingMarketplace] = useState(false);

  // Operation loading states
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  const fetchPlugins = useCallback(async () => {
    if (!transport || !(transport instanceof WebSocketTransport)) {
      setError("WebSocket transport not available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await transport.listPlugins();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, [transport]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const handleAddMarketplace = async () => {
    if (!transport || !(transport instanceof WebSocketTransport)) return;
    if (!newMarketplaceName.trim() || !newMarketplaceUrl.trim()) return;

    try {
      setAddingMarketplace(true);
      await transport.addMarketplace(
        newMarketplaceName.trim(),
        newMarketplaceUrl.trim()
      );
      setAddDialogOpen(false);
      setNewMarketplaceName("");
      setNewMarketplaceUrl("");
      await fetchPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add marketplace"
      );
    } finally {
      setAddingMarketplace(false);
    }
  };

  const handleDeleteMarketplace = async (name: string) => {
    if (!transport || !(transport instanceof WebSocketTransport)) return;

    try {
      setOperationLoading(`delete-${name}`);
      await transport.deleteMarketplace(name);
      await fetchPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete marketplace"
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const handleUpdateMarketplace = async (name: string) => {
    if (!transport || !(transport instanceof WebSocketTransport)) return;

    try {
      setOperationLoading(`update-${name}`);
      await transport.updateMarketplace(name);
      await fetchPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update marketplace"
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const handleToggleMarketplace = async (name: string, enabled: boolean) => {
    if (!transport || !(transport instanceof WebSocketTransport)) return;

    try {
      setOperationLoading(`toggle-${name}`);
      await transport.toggleMarketplace(name, enabled);
      await fetchPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to toggle marketplace"
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const handleTogglePlugin = async (
    pluginName: string,
    marketplaceName: string,
    isInstalled: boolean
  ) => {
    if (!transport || !(transport instanceof WebSocketTransport)) return;

    const pluginKey = `${pluginName}@${marketplaceName}`;

    try {
      setOperationLoading(`plugin-${pluginKey}`);
      if (isInstalled) {
        await transport.uninstallPlugin(pluginKey);
      } else {
        await transport.installPlugin(pluginName, marketplaceName);
      }
      await fetchPlugins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to toggle plugin"
      );
    } finally {
      setOperationLoading(null);
    }
  };

  const toggleMarketplace = (name: string) => {
    setExpandedMarketplaces((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const isPluginInstalled = (
    pluginName: string,
    marketplaceName: string
  ): boolean => {
    if (!data) return false;
    const pluginKey = `${pluginName}@${marketplaceName}`;
    return pluginKey in data.installedPlugins;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading plugins...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h3 className="text-lg font-medium">Plugins</h3>
          <p className="text-sm text-muted-foreground">
            Manage plugins and marketplaces
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={fetchPlugins} className="text-xs sm:text-sm">
            <RefreshCw className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs sm:text-sm">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Marketplace</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Marketplace</DialogTitle>
                <DialogDescription>
                  Add a new plugin marketplace by providing its Git repository
                  URL.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="my-marketplace"
                    value={newMarketplaceName}
                    onChange={(e) => setNewMarketplaceName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="url">Git URL</Label>
                  <Input
                    id="url"
                    placeholder="https://github.com/user/marketplace.git"
                    value={newMarketplaceUrl}
                    onChange={(e) => setNewMarketplaceUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMarketplace}
                  disabled={
                    addingMarketplace ||
                    !newMarketplaceName.trim() ||
                    !newMarketplaceUrl.trim()
                  }
                >
                  {addingMarketplace && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          <AlertCircle className="w-4 h-4" />
          {error}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setError(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Marketplaces list */}
      {data && data.marketplaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No marketplaces added yet
            </p>
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Marketplace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.marketplaces
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((marketplace) => (
            <MarketplaceCard
              key={marketplace.name}
              marketplace={marketplace}
              isExpanded={expandedMarketplaces.has(marketplace.name)}
              onToggle={() => toggleMarketplace(marketplace.name)}
              onDelete={() => handleDeleteMarketplace(marketplace.name)}
              onUpdate={() => handleUpdateMarketplace(marketplace.name)}
              onToggleMarketplace={(enabled) => handleToggleMarketplace(marketplace.name, enabled)}
              onTogglePlugin={handleTogglePlugin}
              isPluginInstalled={isPluginInstalled}
              operationLoading={operationLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MarketplaceCardProps {
  marketplace: MarketplaceInfo;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onToggleMarketplace: (enabled: boolean) => void;
  onTogglePlugin: (
    pluginName: string,
    marketplaceName: string,
    isInstalled: boolean
  ) => void;
  isPluginInstalled: (pluginName: string, marketplaceName: string) => boolean;
  operationLoading: string | null;
}

function MarketplaceCard({
  marketplace,
  isExpanded,
  onToggle,
  onDelete,
  onUpdate,
  onToggleMarketplace,
  onTogglePlugin,
  isPluginInstalled,
  operationLoading,
}: MarketplaceCardProps) {
  const isDeleting = operationLoading === `delete-${marketplace.name}`;
  const isUpdating = operationLoading === `update-${marketplace.name}`;
  const isToggling = operationLoading === `toggle-${marketplace.name}`;

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors min-w-0">
              <ChevronRight
                className={`w-4 h-4 flex-shrink-0 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              <CardTitle className="text-sm sm:text-base truncate">{marketplace.name}</CardTitle>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                ({marketplace.plugins.length})
              </span>
            </CollapsibleTrigger>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 self-end sm:self-auto">
              {marketplace.source.repo && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternalUrl(`https://github.com/${marketplace.source.repo}`);
                  }}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate();
                }}
                disabled={isUpdating || !marketplace.enabled}
                title="Update marketplace"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isUpdating ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isDeleting}
                title="Delete marketplace"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                )}
              </Button>
              {/* Marketplace enable/disable toggle */}
              <div onClick={(e) => e.stopPropagation()}>
                {isToggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Switch
                    checked={marketplace.enabled}
                    onCheckedChange={onToggleMarketplace}
                    title={marketplace.enabled ? "Disable marketplace" : "Enable marketplace"}
                  />
                )}
              </div>
            </div>
          </div>
          {marketplace.description && (
            <CardDescription className="text-xs sm:text-sm mt-1 break-words">{marketplace.description}</CardDescription>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!marketplace.enabled ? (
              <p className="text-sm text-muted-foreground py-2 italic">
                Marketplace is disabled. Enable it to manage plugins.
              </p>
            ) : marketplace.plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No plugins available in this marketplace
              </p>
            ) : (
              <div className="space-y-3">
                {marketplace.plugins
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((plugin) => (
                  <PluginRow
                    key={plugin.name}
                    plugin={plugin}
                    marketplaceName={marketplace.name}
                    isInstalled={isPluginInstalled(plugin.name, marketplace.name)}
                    onToggle={() =>
                      onTogglePlugin(
                        plugin.name,
                        marketplace.name,
                        isPluginInstalled(plugin.name, marketplace.name)
                      )
                    }
                    isLoading={
                      operationLoading ===
                      `plugin-${plugin.name}@${marketplace.name}`
                    }
                    disabled={!marketplace.enabled}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface PluginRowProps {
  plugin: PluginInfo;
  marketplaceName: string;
  isInstalled: boolean;
  onToggle: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

function PluginRow({
  plugin,
  isInstalled,
  onToggle,
  isLoading,
  disabled = false,
}: PluginRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 px-2 sm:px-3 rounded-md bg-muted/50">
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="font-medium text-xs sm:text-sm truncate">{plugin.name}</span>
          {plugin.version && (
            <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
              v{plugin.version}
            </span>
          )}
          {isInstalled && (
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 flex-shrink-0" />
          )}
        </div>
        {plugin.description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
            {plugin.description}
          </p>
        )}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {plugin.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {plugin.homepage && (
          <button
            onClick={() => openExternalUrl(plugin.homepage!)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Switch
            checked={isInstalled}
            onCheckedChange={onToggle}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}
