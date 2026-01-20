import type { Transport, TransportConfig } from "./types";
import { WebSocketTransport } from "./websocket";

export type { Transport, TransportConfig, InitializeResponse, ServerInfo } from "./types";
export { WebSocketTransport } from "./websocket";
export { TransportProvider, useTransport, useRequiredTransport } from "./context";

let transportInstance: Transport | null = null;

// Detect if running in Tauri app (desktop or mobile)
function isTauriApp(): boolean {
  if (typeof window !== "undefined") {
    const win = window as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    return !!(win.__TAURI__ || win.__TAURI_INTERNALS__);
  }
  return false;
}

// Detect if running on mobile device (Android/iOS)
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || "";
  return /android|iphone|ipad|ipod/i.test(userAgent);
}

// Detect if running in mobile Tauri app (not desktop)
export function isMobileTauriApp(): boolean {
  return isTauriApp() && isMobileDevice();
}

// Detect if running in desktop Tauri app
export function isDesktopTauriApp(): boolean {
  return isTauriApp() && !isMobileDevice();
}

// Store the current WebSocket URL for display
let currentWebSocketUrl: string | null = null;

// Get stored WS URL from localStorage (for web clients)
function getStoredWsUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("aero-work-settings");
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.state?.wsUrl || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Get WebSocket URL - always use WebSocket, but different URL for Tauri vs Web
function getWebSocketUrl(): string {
  // Check for environment variable set by Vite
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) {
    return envUrl;
  }

  // Check for stored custom URL (works for both desktop and web)
  const storedUrl = getStoredWsUrl();
  if (storedUrl) {
    return storedUrl;
  }

  // In desktop Tauri app, default to localhost
  if (isDesktopTauriApp()) {
    const port = import.meta.env?.VITE_WS_PORT || "9527";
    return `ws://127.0.0.1:${port}/ws`;
  }

  // Mobile Tauri app needs user to configure URL - return empty to trigger setup dialog
  if (isMobileTauriApp()) {
    // Return a placeholder that will fail and prompt user to configure
    return "ws://PLEASE_CONFIGURE/ws";
  }

  // Default for web: connect to same host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  const port = import.meta.env?.VITE_WS_PORT || "9527";
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

// Helper to check if running in desktop Tauri app (not mobile)
export function isDesktopApp(): boolean {
  return isDesktopTauriApp();
}
