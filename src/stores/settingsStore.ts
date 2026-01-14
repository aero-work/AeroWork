import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";

/**
 * MCP Server configuration
 */
export interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  isDefault: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Permission rule for tool authorization
 */
export interface PermissionRule {
  id: string;
  name: string;
  toolPattern: string;
  pathPattern?: string;
  action: "allow" | "deny" | "ask";
  enabled: boolean;
}

/**
 * Settings panel type
 */
export type SettingsPanel = "general" | "agents" | "models" | "mcp" | "permissions" | null;

interface SettingsState {
  // UI State
  isOpen: boolean;
  activePanel: SettingsPanel;

  // MCP Servers
  mcpServers: MCPServer[];

  // Models
  models: ModelConfig[];
  defaultModelId: string | null;

  // Permission Rules
  permissionRules: PermissionRule[];

  // General Settings
  showHiddenFiles: boolean;
  autoConnect: boolean;
  theme: "light" | "dark" | "system";
}

interface SettingsActions {
  // UI Actions
  openSettings: (panel?: SettingsPanel) => void;
  closeSettings: () => void;
  setActivePanel: (panel: SettingsPanel) => void;

  // MCP Actions
  addMCPServer: (server: Omit<MCPServer, "id">) => void;
  updateMCPServer: (id: string, updates: Partial<MCPServer>) => void;
  removeMCPServer: (id: string) => void;
  toggleMCPServer: (id: string) => void;

  // Model Actions
  addModel: (model: Omit<ModelConfig, "id">) => void;
  updateModel: (id: string, updates: Partial<ModelConfig>) => void;
  removeModel: (id: string) => void;
  setDefaultModel: (id: string) => void;

  // Permission Actions
  addPermissionRule: (rule: Omit<PermissionRule, "id">) => void;
  updatePermissionRule: (id: string, updates: Partial<PermissionRule>) => void;
  removePermissionRule: (id: string) => void;
  togglePermissionRule: (id: string) => void;

  // General Actions
  setShowHiddenFiles: (show: boolean) => void;
  setAutoConnect: (auto: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
}

const initialState: SettingsState = {
  isOpen: false,
  activePanel: null,

  mcpServers: [],

  models: [
    {
      id: "claude-sonnet",
      name: "Claude Sonnet 4",
      provider: "anthropic",
      isDefault: true,
    },
    {
      id: "claude-opus",
      name: "Claude Opus 4",
      provider: "anthropic",
      isDefault: false,
    },
  ],
  defaultModelId: "claude-sonnet",

  permissionRules: [
    {
      id: "default-read",
      name: "Allow file reads",
      toolPattern: "Read",
      action: "allow",
      enabled: true,
    },
    {
      id: "default-write",
      name: "Ask for file writes",
      toolPattern: "Write|Edit",
      action: "ask",
      enabled: true,
    },
    {
      id: "default-bash",
      name: "Ask for bash commands",
      toolPattern: "Bash",
      action: "ask",
      enabled: true,
    },
  ],

  showHiddenFiles: false,
  autoConnect: true,
  theme: "system",
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    immer((set) => ({
      ...initialState,

      // UI Actions
      openSettings: (panel) => {
        set((state) => {
          state.isOpen = true;
          state.activePanel = panel ?? "general";
        });
      },

      closeSettings: () => {
        set((state) => {
          state.isOpen = false;
        });
      },

      setActivePanel: (panel) => {
        set((state) => {
          state.activePanel = panel;
        });
      },

      // MCP Actions
      addMCPServer: (server) => {
        set((state) => {
          state.mcpServers.push({
            ...server,
            id: crypto.randomUUID(),
          });
        });
      },

      updateMCPServer: (id, updates) => {
        set((state) => {
          const index = state.mcpServers.findIndex((s) => s.id === id);
          if (index !== -1) {
            state.mcpServers[index] = { ...state.mcpServers[index], ...updates };
          }
        });
      },

      removeMCPServer: (id) => {
        set((state) => {
          state.mcpServers = state.mcpServers.filter((s) => s.id !== id);
        });
      },

      toggleMCPServer: (id) => {
        set((state) => {
          const server = state.mcpServers.find((s) => s.id === id);
          if (server) {
            server.enabled = !server.enabled;
          }
        });
      },

      // Model Actions
      addModel: (model) => {
        set((state) => {
          state.models.push({
            ...model,
            id: crypto.randomUUID(),
          });
        });
      },

      updateModel: (id, updates) => {
        set((state) => {
          const index = state.models.findIndex((m) => m.id === id);
          if (index !== -1) {
            state.models[index] = { ...state.models[index], ...updates };
          }
        });
      },

      removeModel: (id) => {
        set((state) => {
          state.models = state.models.filter((m) => m.id !== id);
          if (state.defaultModelId === id) {
            state.defaultModelId = state.models[0]?.id ?? null;
          }
        });
      },

      setDefaultModel: (id) => {
        set((state) => {
          state.models.forEach((m) => {
            m.isDefault = m.id === id;
          });
          state.defaultModelId = id;
        });
      },

      // Permission Actions
      addPermissionRule: (rule) => {
        set((state) => {
          state.permissionRules.push({
            ...rule,
            id: crypto.randomUUID(),
          });
        });
      },

      updatePermissionRule: (id, updates) => {
        set((state) => {
          const index = state.permissionRules.findIndex((r) => r.id === id);
          if (index !== -1) {
            state.permissionRules[index] = { ...state.permissionRules[index], ...updates };
          }
        });
      },

      removePermissionRule: (id) => {
        set((state) => {
          state.permissionRules = state.permissionRules.filter((r) => r.id !== id);
        });
      },

      togglePermissionRule: (id) => {
        set((state) => {
          const rule = state.permissionRules.find((r) => r.id === id);
          if (rule) {
            rule.enabled = !rule.enabled;
          }
        });
      },

      // General Actions
      setShowHiddenFiles: (show) => {
        set((state) => {
          state.showHiddenFiles = show;
        });
      },

      setAutoConnect: (auto) => {
        set((state) => {
          state.autoConnect = auto;
        });
      },

      setTheme: (theme) => {
        set((state) => {
          state.theme = theme;
        });
      },
    })),
    {
      name: "aero-code-settings",
      partialize: (state) => ({
        mcpServers: state.mcpServers,
        models: state.models,
        defaultModelId: state.defaultModelId,
        permissionRules: state.permissionRules,
        showHiddenFiles: state.showHiddenFiles,
        autoConnect: state.autoConnect,
        theme: state.theme,
      }),
    }
  )
);
