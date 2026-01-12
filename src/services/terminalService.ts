/**
 * Terminal service that works in both Tauri and WebSocket modes
 */
import { getTransportType } from "./transport";

export interface TerminalInfo {
  id: string;
  working_dir: string;
}

export interface TerminalOutput {
  terminal_id: string;
  data: string;
}

// Dynamic import for Tauri API (only available in Tauri mode)
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, handler: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;

async function getTauriApi() {
  if (tauriInvoke && tauriListen) {
    return { invoke: tauriInvoke, listen: tauriListen };
  }

  if (getTransportType() === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");
    tauriInvoke = invoke;
    tauriListen = listen;
    return { invoke, listen };
  }

  return null;
}

// WebSocket-based implementation
async function wsRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const { getTransport } = await import("./transport");
  const transport = getTransport();

  const ws = transport as { send?: <R>(method: string, params?: unknown) => Promise<R> };

  if (ws.send) {
    return ws.send<T>(method, params);
  }

  throw new Error("WebSocket transport not available");
}

export async function createTerminal(
  workingDir: string,
  cols: number,
  rows: number
): Promise<string> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api) {
      return api.invoke("create_terminal", { workingDir, cols, rows }) as Promise<string>;
    }
  }

  // WebSocket mode
  return wsRequest<string>("create_terminal", { cwd: workingDir, cols, rows });
}

export async function writeTerminal(terminalId: string, data: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api) {
      await api.invoke("write_terminal", { terminalId, data });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("write_terminal", { terminalId, data });
}

export async function resizeTerminal(
  terminalId: string,
  cols: number,
  rows: number
): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api) {
      await api.invoke("resize_terminal", { terminalId, cols, rows });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("resize_terminal", { terminalId, cols, rows });
}

export async function killTerminal(terminalId: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api) {
      await api.invoke("kill_terminal", { terminalId });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("kill_terminal", { terminalId });
}

export async function listTerminals(): Promise<TerminalInfo[]> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api) {
      return api.invoke("list_terminals") as Promise<TerminalInfo[]>;
    }
  }

  // WebSocket mode
  return wsRequest<TerminalInfo[]>("list_terminals", {});
}

// Terminal output event listener
const outputCallbacks = new Map<string, (data: string) => void>();
let unlistenFn: (() => void) | null = null;

export async function setupTerminalOutputListener(): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const api = await getTauriApi();
    if (api && !unlistenFn) {
      unlistenFn = await api.listen("terminal:output", (event) => {
        const output = event.payload as TerminalOutput;
        const callback = outputCallbacks.get(output.terminal_id);
        if (callback) {
          callback(output.data);
        }
      });
    }
  } else {
    // WebSocket mode - use transport's terminal output subscription
    const { getTransport } = await import("./transport");
    const transport = getTransport();
    const ws = transport as {
      onTerminalOutput?: (handler: (output: TerminalOutput) => void) => () => void;
    };

    if (ws.onTerminalOutput && !unlistenFn) {
      unlistenFn = ws.onTerminalOutput((output) => {
        // Handle both snake_case (from server) and camelCase property names
        const terminalId = (output as { terminalId?: string; terminal_id?: string }).terminalId
          || (output as { terminal_id?: string }).terminal_id;
        if (terminalId) {
          const callback = outputCallbacks.get(terminalId);
          if (callback) {
            callback(output.data);
          }
        }
      });
    }
  }
}

export function registerTerminalOutputCallback(
  terminalId: string,
  callback: (data: string) => void
): () => void {
  outputCallbacks.set(terminalId, callback);
  return () => {
    outputCallbacks.delete(terminalId);
  };
}

export function cleanupTerminalOutputListener(): void {
  if (unlistenFn) {
    unlistenFn();
    unlistenFn = null;
  }
  outputCallbacks.clear();
}
