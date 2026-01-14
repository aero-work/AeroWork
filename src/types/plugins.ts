/**
 * Plugin Types
 *
 * TypeScript types for plugin management.
 * Must match the Rust types in src-tauri/src/core/plugins.rs
 */

/** Information about a plugin */
export interface PluginInfo {
  name: string;
  description?: string;
  version?: string;
  category?: string;
  source?: string;
  homepage?: string;
  tags?: string[];
  author?: {
    name?: string;
    email?: string;
    url?: string;
  };
  skills?: string[];
  lspServers?: Record<string, unknown>;
  strict?: boolean;
}

/** Information about an installed plugin */
export interface InstalledPluginInfo {
  scope: string;
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  isLocal: boolean;
}

/** Source information for a marketplace */
export interface MarketplaceSource {
  source: string;
  repo: string;
}

/** Information about a marketplace */
export interface MarketplaceInfo {
  name: string;
  description?: string;
  source: MarketplaceSource;
  installLocation: string;
  lastUpdated: string;
  owner?: {
    name?: string;
    url?: string;
  };
  plugins: PluginInfo[];
  /** Whether this marketplace is enabled (default: true) */
  enabled: boolean;
}

/** Response for listing plugins */
export interface ListPluginsResponse {
  marketplaces: MarketplaceInfo[];
  installedPlugins: Record<string, InstalledPluginInfo[]>;
}

/** Response for marketplace operations */
export interface MarketplaceResponse {
  status: string;
  message: string;
  marketplaceName: string;
}

/** Response for plugin install operations */
export interface InstallPluginResponse {
  status: string;
  message: string;
  pluginName: string;
  marketplaceName: string;
}

/** Response for plugin uninstall operations */
export interface UninstallPluginResponse {
  status: string;
  message: string;
  pluginName: string;
}
