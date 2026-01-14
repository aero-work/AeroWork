//! Configuration Module
//!
//! Manages persistent configuration for Aero Code.
//! Follows XDG Base Directory Specification:
//! - Config: ~/.config/aero-code/ (or $XDG_CONFIG_HOME/aero-code/)
//! - Data: ~/.local/share/aero-code/ (or $XDG_DATA_HOME/aero-code/)
//! - Cache: ~/.cache/aero-code/ (or $XDG_CACHE_HOME/aero-code/)

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tracing::{info, warn};

/// Application name for directory paths
const APP_NAME: &str = "aero-code";

/// Main configuration file name
const CONFIG_FILE: &str = "config.json";

/// Get the configuration directory path
/// Returns ~/.config/aero-code/ or $XDG_CONFIG_HOME/aero-code/
pub fn config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".config"))
        .join(APP_NAME)
}

/// Get the data directory path
/// Returns ~/.local/share/aero-code/ or $XDG_DATA_HOME/aero-code/
pub fn data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".local/share")
        })
        .join(APP_NAME)
}

/// Get the cache directory path
/// Returns ~/.cache/aero-code/ or $XDG_CACHE_HOME/aero-code/
pub fn cache_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".cache")
        })
        .join(APP_NAME)
}

/// Aero Code configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Server configuration
    #[serde(default)]
    pub server: ServerConfig,

    /// Agent configuration
    #[serde(default)]
    pub agent: AgentConfig,

    /// Model configuration
    #[serde(default)]
    pub model: ModelConfig,
}

/// Server-related configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    /// WebSocket server port
    #[serde(default = "default_port")]
    pub port: u16,

    /// Host to bind to
    #[serde(default = "default_host")]
    pub host: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            port: default_port(),
            host: default_host(),
        }
    }
}

fn default_port() -> u16 {
    9888
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

/// Agent-related configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    /// Default agent command (e.g., "npx @anthropics/claude-code")
    #[serde(default)]
    pub default_command: Option<String>,

    /// Agent-specific settings (placeholder for future use)
    #[serde(default)]
    pub settings: serde_json::Value,
}

/// Model-related configuration
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    /// Default model ID
    #[serde(default)]
    pub default_model: Option<String>,

    /// Model-specific settings (placeholder for future use)
    #[serde(default)]
    pub settings: serde_json::Value,
}

/// Configuration manager
pub struct ConfigManager {
    config: Config,
    config_path: PathBuf,
}

impl ConfigManager {
    /// Create a new config manager and load existing config
    pub fn new() -> Self {
        let config_path = config_dir().join(CONFIG_FILE);
        let config = Self::load_from_path(&config_path).unwrap_or_default();

        Self { config, config_path }
    }

    /// Load configuration from a specific path
    fn load_from_path(path: &PathBuf) -> Option<Config> {
        if !path.exists() {
            return None;
        }

        match std::fs::read_to_string(path) {
            Ok(content) => match serde_json::from_str(&content) {
                Ok(config) => {
                    info!("Loaded config from {:?}", path);
                    Some(config)
                }
                Err(e) => {
                    warn!("Failed to parse config file: {}", e);
                    None
                }
            },
            Err(e) => {
                warn!("Failed to read config file: {}", e);
                None
            }
        }
    }

    /// Get current configuration
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Get mutable configuration
    pub fn config_mut(&mut self) -> &mut Config {
        &mut self.config
    }

    /// Save configuration to disk
    pub fn save(&self) -> Result<(), String> {
        // Ensure config directory exists
        if let Some(parent) = self.config_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }

        let content = serde_json::to_string_pretty(&self.config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        std::fs::write(&self.config_path, content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;

        info!("Saved config to {:?}", self.config_path);
        Ok(())
    }

    /// Get config file path
    pub fn config_path(&self) -> &PathBuf {
        &self.config_path
    }
}

impl Default for ConfigManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Ensure all application directories exist
pub fn ensure_directories() -> Result<(), String> {
    for dir in [config_dir(), data_dir(), cache_dir()] {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create directory {:?}: {}", dir, e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.server.port, 9888);
        assert_eq!(config.server.host, "0.0.0.0");
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.server.port, config.server.port);
    }
}
