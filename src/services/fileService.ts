/**
 * File service that works in both Tauri and WebSocket modes
 */
import { getTransportType } from "./transport";

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  isHidden: boolean;
  size?: number;
  modified?: number;
}

export interface FileContent {
  path: string;
  content: string;
  language?: string;
}

// Dynamic import for Tauri API (only available in Tauri mode)
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;

async function getInvoke() {
  if (tauriInvoke) return tauriInvoke;

  if (getTransportType() === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    tauriInvoke = invoke;
    return invoke;
  }

  return null;
}

// WebSocket-based implementation
async function wsRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
  const { getTransport } = await import("./transport");
  const transport = getTransport();

  // Use the WebSocket transport's internal send method
  // We need to cast since Transport interface doesn't expose this
  const ws = transport as { send?: <R>(method: string, params?: unknown) => Promise<R> };

  if (ws.send) {
    return ws.send<T>(method, params);
  }

  throw new Error("WebSocket transport not available");
}

export async function listDirectory(path: string, showHidden = true): Promise<FileEntry[]> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      return invoke("list_directory", { path, showHidden }) as Promise<FileEntry[]>;
    }
  }

  // WebSocket mode
  return wsRequest<FileEntry[]>("list_directory", { path });
}

export async function readFile(path: string): Promise<FileContent> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      return invoke("read_file", { path }) as Promise<FileContent>;
    }
  }

  // WebSocket mode
  const content = await wsRequest<string>("read_file", { path });
  return { path, content };
}

export async function writeFile(path: string, content: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      await invoke("write_file", { path, content });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("write_file", { path, content });
}

export async function createFile(path: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      await invoke("create_file", { path });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("create_file", { path });
}

export async function createDirectory(path: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      await invoke("create_directory", { path });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("create_directory", { path });
}

export async function deletePath(path: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      await invoke("delete_path", { path });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("delete_path", { path });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  const transportType = getTransportType();

  if (transportType === "tauri") {
    const invoke = await getInvoke();
    if (invoke) {
      await invoke("rename_path", { oldPath, newPath });
      return;
    }
  }

  // WebSocket mode
  await wsRequest<void>("rename_path", { from: oldPath, to: newPath });
}
