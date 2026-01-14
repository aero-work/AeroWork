/**
 * Terminal service - uses WebSocket for all operations
 */
import { getTransport } from "./transport";
import { WebSocketTransport } from "./transport/websocket";

export interface TerminalInfo {
  id: string;
  working_dir: string;
}

export interface TerminalOutput {
  terminalId: string;
  data: string;
}

function getWsTransport(): WebSocketTransport {
  const transport = getTransport();
  return transport as WebSocketTransport;
}

export async function createTerminal(
  workingDir: string,
  cols: number,
  rows: number
): Promise<string> {
  return getWsTransport().send<string>("create_terminal", { cwd: workingDir, cols, rows });
}

export async function writeTerminal(terminalId: string, data: string): Promise<void> {
  await getWsTransport().send<void>("write_terminal", { terminalId, data });
}

export async function resizeTerminal(
  terminalId: string,
  cols: number,
  rows: number
): Promise<void> {
  await getWsTransport().send<void>("resize_terminal", { terminalId, cols, rows });
}

export async function killTerminal(terminalId: string): Promise<void> {
  await getWsTransport().send<void>("kill_terminal", { terminalId });
}

export async function listTerminals(): Promise<TerminalInfo[]> {
  return getWsTransport().send<TerminalInfo[]>("list_terminals", {});
}

// Terminal output event listener
const outputCallbacks = new Map<string, (data: string) => void>();
let unlistenFn: (() => void) | null = null;

export async function setupTerminalOutputListener(): Promise<void> {
  const ws = getWsTransport();

  if (!unlistenFn) {
    unlistenFn = ws.onTerminalOutput((output) => {
      const callback = outputCallbacks.get(output.terminalId);
      if (callback) {
        callback(output.data);
      }
    });
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
