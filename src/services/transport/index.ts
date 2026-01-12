import type { Transport, TransportConfig } from "./types";
import { TauriTransport } from "./tauri";
import { WebSocketTransport } from "./websocket";

export type { Transport, TransportConfig, InitializeResponse } from "./types";
export { TauriTransport } from "./tauri";
export { WebSocketTransport } from "./websocket";

let transportInstance: Transport | null = null;

// Detect if running in Tauri or browser
function detectTransportType(): "tauri" | "websocket" {
  // Check if Tauri API is available (Tauri 2.0 uses __TAURI_INTERNALS__)
  if (typeof window !== "undefined") {
    const win = window as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    if (win.__TAURI__ || win.__TAURI_INTERNALS__) {
      return "tauri";
    }
  }
  return "websocket";
}

// Get WebSocket URL from environment or use default
function getWebSocketUrl(): string {
  // Check for environment variable set by Vite
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  // Default to same host with WebSocket port
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  const port = import.meta.env?.VITE_WS_PORT || "8765";
  return `${protocol}//${host}:${port}/ws`;
}

export function createTransport(config: TransportConfig): Transport {
  switch (config.type) {
    case "tauri":
      return new TauriTransport();
    case "websocket": {
      const url = config.websocketUrl || getWebSocketUrl();
      return new WebSocketTransport(url);
    }
    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}

export function getTransport(): Transport {
  if (!transportInstance) {
    const type = detectTransportType();
    console.log(`Auto-detected transport type: ${type}`);
    transportInstance = createTransport({ type });
  }
  return transportInstance;
}

export function setTransport(transport: Transport): void {
  transportInstance = transport;
}

// Helper to get the current transport type
export function getTransportType(): "tauri" | "websocket" {
  return detectTransportType();
}
