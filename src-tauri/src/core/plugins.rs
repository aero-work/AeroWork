//! Plugin Management Module
//!
//! Manages Claude plugins and marketplaces.
//! Handles:
//! - Listing marketplaces and their plugins
//! - Adding/removing marketplaces (clone/delete git repos)
//! - Enabling/disabling plugins (modify installed_plugins.json)

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use tracing::{debug, info, warn};

/// Get the Claude directory path
fn claude_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude")
}

/// Get the plugins directory path
fn plugins_dir() -> PathBuf {
    claude_dir().join("plugins")
}

/// Get the marketplaces directory path
fn marketplaces_dir() -> PathBuf {
    plugins_dir().join("marketplaces")
}

/// Get the known marketplaces JSON path
fn known_marketplaces_path() -> PathBuf {
    plugins_dir().join("known_marketplaces.json")
}

/// Get the installed plugins JSON path
fn installed_plugins_path() -> PathBuf {
    plugins_dir().join("installed_plugins.json")
}

/// Get the Claude settings JSON path
fn settings_path() -> PathBuf {
    claude_dir().join("settings.json")
}

// ============================================================================
// Data Types
// ============================================================================

/// Information about a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lsp_servers: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

/// Information about an installed plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPluginInfo {
    pub scope: String,
    pub install_path: String,
    pub version: String,
    pub installed_at: String,
    pub last_updated: String,
    pub is_local: bool,
}

/// Source information for a marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSource {
    pub source: String,
    pub repo: String,
}

/// Information about a marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub source: MarketplaceSource,
    pub install_location: String,
    pub last_updated: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner: Option<serde_json::Value>,
    pub plugins: Vec<PluginInfo>,
    /// Whether this marketplace is enabled (default: true)
    pub enabled: bool,
}

/// Response for listing plugins
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPluginsResponse {
    pub marketplaces: Vec<MarketplaceInfo>,
    pub installed_plugins: HashMap<String, Vec<InstalledPluginInfo>>,
}

/// Request to add a marketplace
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddMarketplaceRequest {
    pub name: String,
    pub git_url: String,
}

/// Response for marketplace operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceResponse {
    pub status: String,
    pub message: String,
    pub marketplace_name: String,
}

/// Request to install a plugin
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPluginRequest {
    pub plugin_name: String,
    pub marketplace_name: String,
}

/// Response for plugin install operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPluginResponse {
    pub status: String,
    pub message: String,
    pub plugin_name: String,
    pub marketplace_name: String,
}

/// Response for plugin uninstall operations
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallPluginResponse {
    pub status: String,
    pub message: String,
    pub plugin_name: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Read and parse a JSON file
fn read_json_file<T: for<'de> Deserialize<'de> + Default>(path: &PathBuf) -> T {
    if !path.exists() {
        return T::default();
    }
    match std::fs::read_to_string(path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(e) => {
            warn!("Failed to read {:?}: {}", path, e);
            T::default()
        }
    }
}

/// Write data to a JSON file
fn write_json_file<T: Serialize>(path: &PathBuf, data: &T) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    std::fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

/// Enable a plugin in settings.json
fn enable_plugin_in_settings(plugin_key: &str) -> Result<(), String> {
    let path = settings_path();
    let mut settings: serde_json::Value = read_json_file(&path);

    if settings.is_null() {
        settings = serde_json::json!({});
    }

    if settings.get("enabledPlugins").is_none() {
        settings["enabledPlugins"] = serde_json::json!({});
    }

    settings["enabledPlugins"][plugin_key] = serde_json::json!(true);
    write_json_file(&path, &settings)?;
    info!("Enabled plugin '{}' in settings.json", plugin_key);
    Ok(())
}

/// Disable a plugin in settings.json
fn disable_plugin_in_settings(plugin_key: &str) -> Result<(), String> {
    let path = settings_path();
    let mut settings: serde_json::Value = read_json_file(&path);

    if let Some(enabled_plugins) = settings.get_mut("enabledPlugins") {
        if let Some(obj) = enabled_plugins.as_object_mut() {
            obj.remove(plugin_key);
            write_json_file(&path, &settings)?;
            info!("Disabled plugin '{}' in settings.json", plugin_key);
        }
    }
    Ok(())
}

/// Load plugins from a marketplace directory
fn load_marketplace_plugins(marketplace_dir: &PathBuf) -> (Option<serde_json::Value>, Vec<PluginInfo>) {
    let marketplace_json_path = marketplace_dir.join(".claude-plugin").join("marketplace.json");

    if !marketplace_json_path.exists() {
        debug!("Marketplace JSON not found at {:?}", marketplace_json_path);
        return (None, vec![]);
    }

    let content = match std::fs::read_to_string(&marketplace_json_path) {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to read marketplace JSON: {}", e);
            return (None, vec![]);
        }
    };

    let marketplace_data: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse marketplace JSON: {}", e);
            return (None, vec![]);
        }
    };

    let mut plugins = vec![];
    if let Some(plugins_array) = marketplace_data.get("plugins").and_then(|v| v.as_array()) {
        for plugin_data in plugins_array {
            let plugin = PluginInfo {
                name: plugin_data.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                description: plugin_data.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                version: plugin_data.get("version").and_then(|v| v.as_str()).map(|s| s.to_string()),
                category: plugin_data.get("category").and_then(|v| v.as_str()).map(|s| s.to_string()),
                source: plugin_data.get("source").and_then(|v| v.as_str()).map(|s| s.to_string()),
                homepage: plugin_data.get("homepage").and_then(|v| v.as_str()).map(|s| s.to_string()),
                tags: plugin_data.get("tags").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                }),
                author: plugin_data.get("author").cloned(),
                skills: plugin_data.get("skills").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()
                }),
                lsp_servers: plugin_data.get("lspServers").cloned(),
                strict: plugin_data.get("strict").and_then(|v| v.as_bool()),
            };
            plugins.push(plugin);
        }
    }

    (Some(marketplace_data), plugins)
}

// ============================================================================
// Plugin Manager
// ============================================================================

/// Plugin Manager - handles all plugin operations
pub struct PluginManager;

impl PluginManager {
    /// List all marketplaces and their plugins
    pub fn list_plugins() -> Result<ListPluginsResponse, String> {
        info!("Listing plugins and marketplaces");

        // Load known marketplaces
        let known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        // Load installed plugins
        let installed_data: serde_json::Value = read_json_file(&installed_plugins_path());
        let installed_plugins_raw = installed_data
            .get("plugins")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        // Convert installed plugins to response format
        let mut installed_plugins: HashMap<String, Vec<InstalledPluginInfo>> = HashMap::new();
        for (plugin_key, install_list) in installed_plugins_raw {
            if let Some(arr) = install_list.as_array() {
                let infos: Vec<InstalledPluginInfo> = arr
                    .iter()
                    .filter_map(|info| {
                        Some(InstalledPluginInfo {
                            scope: info.get("scope").and_then(|v| v.as_str()).unwrap_or("user").to_string(),
                            install_path: info.get("installPath").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            version: info.get("version").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                            installed_at: info.get("installedAt").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            last_updated: info.get("lastUpdated").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            is_local: info.get("isLocal").and_then(|v| v.as_bool()).unwrap_or(false),
                        })
                    })
                    .collect();
                installed_plugins.insert(plugin_key, infos);
            }
        }

        // Load marketplace details
        let mut marketplaces = vec![];
        for (marketplace_name, marketplace_info) in known_marketplaces {
            let install_location = marketplace_info
                .get("installLocation")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let marketplace_dir = PathBuf::from(&install_location);

            let (marketplace_data, plugins) = load_marketplace_plugins(&marketplace_dir);

            let owner = marketplace_data.as_ref().and_then(|d| d.get("owner").cloned());
            let description = marketplace_data
                .as_ref()
                .and_then(|d| d.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()));

            let source_obj = marketplace_info.get("source").cloned().unwrap_or(serde_json::json!({}));
            let source = MarketplaceSource {
                source: source_obj.get("source").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                repo: source_obj.get("repo").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            };

            let enabled = marketplace_info
                .get("enabled")
                .and_then(|v| v.as_bool())
                .unwrap_or(true); // Default to enabled

            let marketplace = MarketplaceInfo {
                name: marketplace_name,
                description,
                source,
                install_location,
                last_updated: marketplace_info
                    .get("lastUpdated")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                owner,
                plugins,
                enabled,
            };
            marketplaces.append(&mut vec![marketplace]);
        }

        Ok(ListPluginsResponse {
            marketplaces,
            installed_plugins,
        })
    }

    /// Add a new marketplace by cloning a git repository
    pub async fn add_marketplace(request: AddMarketplaceRequest) -> Result<MarketplaceResponse, String> {
        info!("Adding marketplace '{}' from {}", request.name, request.git_url);

        // Check if marketplace already exists
        let mut known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        if known_marketplaces.contains_key(&request.name) {
            return Err(format!("Marketplace '{}' already exists", request.name));
        }

        // Determine install location
        let install_location = marketplaces_dir().join(&request.name);

        if install_location.exists() {
            return Err(format!("Directory already exists at {:?}", install_location));
        }

        // Ensure parent directory exists
        std::fs::create_dir_all(marketplaces_dir())
            .map_err(|e| format!("Failed to create marketplaces directory: {}", e))?;

        // Clone the repository
        let output = Command::new("git")
            .args(["clone", &request.git_url, install_location.to_str().unwrap()])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute git clone: {}", e))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            // Clean up on failure
            let _ = std::fs::remove_dir_all(&install_location);
            return Err(format!("Git clone failed: {}", error_msg));
        }

        // Extract repo info from git URL
        let mut repo_info = request.git_url.clone();
        if repo_info.ends_with(".git") {
            repo_info = repo_info[..repo_info.len() - 4].to_string();
        }
        if let Some(idx) = repo_info.find("github.com/") {
            repo_info = repo_info[idx + 11..].to_string();
        }

        // Update known_marketplaces.json
        let now: DateTime<Utc> = Utc::now();
        known_marketplaces.insert(
            request.name.clone(),
            serde_json::json!({
                "source": {
                    "source": "github",
                    "repo": repo_info
                },
                "installLocation": install_location.to_str().unwrap(),
                "lastUpdated": now.to_rfc3339()
            }),
        );

        write_json_file(&known_marketplaces_path(), &known_marketplaces)?;

        info!("Successfully added marketplace '{}'", request.name);
        Ok(MarketplaceResponse {
            status: "success".to_string(),
            message: format!("Marketplace '{}' added successfully", request.name),
            marketplace_name: request.name,
        })
    }

    /// Delete a marketplace
    pub fn delete_marketplace(marketplace_name: &str) -> Result<MarketplaceResponse, String> {
        info!("Deleting marketplace '{}'", marketplace_name);

        // Load known marketplaces
        let mut known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        if !known_marketplaces.contains_key(marketplace_name) {
            return Err(format!("Marketplace '{}' not found", marketplace_name));
        }

        // Get install location
        let install_location = known_marketplaces[marketplace_name]
            .get("installLocation")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Remove from known_marketplaces.json
        known_marketplaces.remove(marketplace_name);
        write_json_file(&known_marketplaces_path(), &known_marketplaces)?;

        // Delete the directory
        if !install_location.is_empty() {
            let path = PathBuf::from(&install_location);
            if path.exists() {
                std::fs::remove_dir_all(&path)
                    .map_err(|e| format!("Failed to delete directory: {}", e))?;
                info!("Deleted marketplace directory: {}", install_location);
            }
        }

        // Remove any installed plugins from this marketplace
        let mut installed_data: serde_json::Value = read_json_file(&installed_plugins_path());
        if let Some(plugins) = installed_data.get_mut("plugins").and_then(|v| v.as_object_mut()) {
            let keys_to_remove: Vec<String> = plugins
                .keys()
                .filter(|k| k.ends_with(&format!("@{}", marketplace_name)))
                .cloned()
                .collect();

            for key in &keys_to_remove {
                plugins.remove(key);
                let _ = disable_plugin_in_settings(key);
                info!("Removed installed plugin: {}", key);
            }

            if !keys_to_remove.is_empty() {
                write_json_file(&installed_plugins_path(), &installed_data)?;
            }
        }

        info!("Successfully deleted marketplace '{}'", marketplace_name);
        Ok(MarketplaceResponse {
            status: "success".to_string(),
            message: format!("Marketplace '{}' deleted successfully", marketplace_name),
            marketplace_name: marketplace_name.to_string(),
        })
    }

    /// Update a marketplace by pulling the latest changes
    pub async fn update_marketplace(marketplace_name: &str) -> Result<MarketplaceResponse, String> {
        info!("Updating marketplace '{}'", marketplace_name);

        // Load known marketplaces
        let mut known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        if !known_marketplaces.contains_key(marketplace_name) {
            return Err(format!("Marketplace '{}' not found", marketplace_name));
        }

        let install_location = known_marketplaces[marketplace_name]
            .get("installLocation")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if install_location.is_empty() || !PathBuf::from(&install_location).exists() {
            return Err(format!(
                "Marketplace directory not found at {}",
                install_location
            ));
        }

        // Pull latest changes
        let output = Command::new("git")
            .args(["pull"])
            .current_dir(&install_location)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
            .map_err(|e| format!("Failed to execute git pull: {}", e))?;

        if !output.status.success() {
            let error_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Git pull failed: {}", error_msg));
        }

        // Update lastUpdated timestamp
        let now: DateTime<Utc> = Utc::now();
        if let Some(marketplace_info) = known_marketplaces.get_mut(marketplace_name) {
            marketplace_info["lastUpdated"] = serde_json::json!(now.to_rfc3339());
        }
        write_json_file(&known_marketplaces_path(), &known_marketplaces)?;

        info!("Successfully updated marketplace '{}'", marketplace_name);
        Ok(MarketplaceResponse {
            status: "success".to_string(),
            message: format!("Marketplace '{}' updated successfully", marketplace_name),
            marketplace_name: marketplace_name.to_string(),
        })
    }

    /// Install/enable a plugin
    pub fn install_plugin(request: InstallPluginRequest) -> Result<InstallPluginResponse, String> {
        info!(
            "Installing plugin '{}' from '{}'",
            request.plugin_name, request.marketplace_name
        );

        // Verify marketplace exists
        let known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        if !known_marketplaces.contains_key(&request.marketplace_name) {
            return Err(format!(
                "Marketplace '{}' not found",
                request.marketplace_name
            ));
        }

        // Load marketplace to verify plugin exists
        let marketplace_info = &known_marketplaces[&request.marketplace_name];
        let marketplace_dir = PathBuf::from(
            marketplace_info
                .get("installLocation")
                .and_then(|v| v.as_str())
                .unwrap_or(""),
        );
        let (_, plugins) = load_marketplace_plugins(&marketplace_dir);

        // Find the plugin
        let plugin_info = plugins.iter().find(|p| p.name == request.plugin_name);
        if plugin_info.is_none() {
            return Err(format!(
                "Plugin '{}' not found in marketplace '{}'",
                request.plugin_name, request.marketplace_name
            ));
        }
        let plugin_info = plugin_info.unwrap();

        // Load installed plugins
        let mut installed_data: serde_json::Value = read_json_file(&installed_plugins_path());
        if installed_data.is_null() {
            installed_data = serde_json::json!({
                "version": 2,
                "plugins": {}
            });
        }
        if installed_data.get("plugins").is_none() {
            installed_data["plugins"] = serde_json::json!({});
        }

        // Create plugin key
        let plugin_key = format!("{}@{}", request.plugin_name, request.marketplace_name);

        // Check if already installed
        if installed_data["plugins"].get(&plugin_key).is_some() {
            return Ok(InstallPluginResponse {
                status: "already_installed".to_string(),
                message: format!("Plugin '{}' is already installed", request.plugin_name),
                plugin_name: request.plugin_name,
                marketplace_name: request.marketplace_name,
            });
        }

        // Create install entry
        let now: DateTime<Utc> = Utc::now();
        let version = plugin_info.version.clone().unwrap_or("unknown".to_string());
        let cache_path = plugins_dir()
            .join("cache")
            .join(&request.marketplace_name)
            .join(&request.plugin_name)
            .join(&version);

        let install_entry = serde_json::json!({
            "scope": "user",
            "installPath": cache_path.to_str().unwrap_or(""),
            "version": version,
            "installedAt": now.to_rfc3339(),
            "lastUpdated": now.to_rfc3339(),
            "isLocal": true
        });

        installed_data["plugins"][&plugin_key] = serde_json::json!([install_entry]);

        // Write updated installed plugins
        write_json_file(&installed_plugins_path(), &installed_data)?;

        // Enable in settings.json
        enable_plugin_in_settings(&plugin_key)?;

        info!("Successfully installed plugin '{}'", request.plugin_name);
        Ok(InstallPluginResponse {
            status: "success".to_string(),
            message: format!("Plugin '{}' installed successfully", request.plugin_name),
            plugin_name: request.plugin_name,
            marketplace_name: request.marketplace_name,
        })
    }

    /// Toggle marketplace enabled state
    pub fn toggle_marketplace(marketplace_name: &str, enabled: bool) -> Result<MarketplaceResponse, String> {
        info!("Toggling marketplace '{}' to enabled={}", marketplace_name, enabled);

        // Load known marketplaces
        let mut known_marketplaces: HashMap<String, serde_json::Value> =
            read_json_file(&known_marketplaces_path());

        if !known_marketplaces.contains_key(marketplace_name) {
            return Err(format!("Marketplace '{}' not found", marketplace_name));
        }

        // Update enabled state
        if let Some(marketplace_info) = known_marketplaces.get_mut(marketplace_name) {
            marketplace_info["enabled"] = serde_json::json!(enabled);
        }

        write_json_file(&known_marketplaces_path(), &known_marketplaces)?;

        // Load installed plugins to find plugins from this marketplace
        let installed_data: serde_json::Value = read_json_file(&installed_plugins_path());
        if let Some(plugins) = installed_data.get("plugins").and_then(|v| v.as_object()) {
            for plugin_key in plugins.keys() {
                if plugin_key.ends_with(&format!("@{}", marketplace_name)) {
                    if enabled {
                        // Re-enable plugins when marketplace is enabled
                        let _ = enable_plugin_in_settings(plugin_key);
                    } else {
                        // Disable plugins when marketplace is disabled
                        let _ = disable_plugin_in_settings(plugin_key);
                    }
                }
            }
        }

        info!("Successfully toggled marketplace '{}' to enabled={}", marketplace_name, enabled);
        Ok(MarketplaceResponse {
            status: "success".to_string(),
            message: format!("Marketplace '{}' {} successfully", marketplace_name, if enabled { "enabled" } else { "disabled" }),
            marketplace_name: marketplace_name.to_string(),
        })
    }

    /// Uninstall/disable a plugin
    pub fn uninstall_plugin(plugin_key: &str) -> Result<UninstallPluginResponse, String> {
        info!("Uninstalling plugin '{}'", plugin_key);

        // Load installed plugins
        let mut installed_data: serde_json::Value = read_json_file(&installed_plugins_path());

        if installed_data["plugins"].get(plugin_key).is_none() {
            return Err(format!("Plugin '{}' is not installed", plugin_key));
        }

        // Remove the plugin
        if let Some(plugins) = installed_data.get_mut("plugins").and_then(|v| v.as_object_mut()) {
            plugins.remove(plugin_key);
        }

        // Write updated installed plugins
        write_json_file(&installed_plugins_path(), &installed_data)?;

        // Disable in settings.json
        disable_plugin_in_settings(plugin_key)?;

        info!("Successfully uninstalled plugin '{}'", plugin_key);
        Ok(UninstallPluginResponse {
            status: "success".to_string(),
            message: format!("Plugin '{}' uninstalled successfully", plugin_key),
            plugin_name: plugin_key.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paths() {
        let claude = claude_dir();
        assert!(claude.ends_with(".claude"));

        let plugins = plugins_dir();
        assert!(plugins.ends_with("plugins"));
    }
}
