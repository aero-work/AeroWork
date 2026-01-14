import type { Transport, TransportConfig } from "./types";
import { WebSocketTransport } from "./websocket";

export type { Transport, TransportConfig, InitializeResponse } from "./types";
export { WebSocketTransport } from "./websocket";
export { TransportProvider, useTransport, useRequiredTransport } from "./context";

let transportInstance: Transport | null = null;

// Detect if running in Tauri desktop app
function isTauriApp(): boolean {
  if (typeof window !== "undefined") {
    const win = window as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    return !!(win.__TAURI__ || win.__TAURI_INTERNALS__);
  }
  return false;
}

// Store the current WebSocket URL for display
let currentWebSocketUrl: string | null = null;

// Get WebSocket URL - always use WebSocket, but different URL for Tauri vs Web
function getWebSocketUrl(): string {
  // Check for environment variable set by Vite
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  // In Tauri app, always connect to localhost
  if (isTauriApp()) {
    const port = import.meta.env?.VITE_WS_PORT || "8765";
    return `ws://127.0.0.1:${port}/ws`;
  }

  // For web, connect to same host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  const port = import.meta.env?.VITE_WS_PORT || "8765";
  return `${protocol}//${host}:${port}/ws`;
}

export function createTransport(config: TransportConfig): Transport {
  const url = config.websocketUrl || getWebSocketUrl();
  return new WebSocketTransport(url);
}

export function getTransport(): Transport {
  if (!transportInstance) {
    const url = getWebSocketUrl();
    currentWebSocketUrl = url;
    console.log(`Creating WebSocket transport: ${url}`);
    transportInstance = new WebSocketTransport(url);
  }
  return transportInstance;
}

/**
 * Get the current WebSocket endpoint URL
 */
export function getWebSocketEndpoint(): string | null {
  return currentWebSocketUrl;
}

export function setTransport(transport: Transport): void {
  transportInstance = transport;
}

// Helper to check if running in Tauri
export function isDesktopApp(): boolean {
  return isTauriApp();
}
