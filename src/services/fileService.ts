/**
 * File service - uses WebSocket for all operations
 */
import { getTransport } from "./transport";
import { WebSocketTransport } from "./transport/websocket";

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

function getWsTransport(): WebSocketTransport {
  const transport = getTransport();
  return transport as WebSocketTransport;
}

export async function listDirectory(path: string, showHidden = true): Promise<FileEntry[]> {
  return getWsTransport().send<FileEntry[]>("list_directory", { path, showHidden });
}

export async function readFile(path: string): Promise<FileContent> {
  const content = await getWsTransport().send<string>("read_file", { path });
  return { path, content };
}

export async function writeFile(path: string, content: string): Promise<void> {
  await getWsTransport().send<void>("write_file", { path, content });
}

export async function createFile(path: string): Promise<void> {
  await getWsTransport().send<void>("create_file", { path });
}

export async function createDirectory(path: string): Promise<void> {
  await getWsTransport().send<void>("create_directory", { path });
}

export async function deletePath(path: string): Promise<void> {
  await getWsTransport().send<void>("delete_path", { path });
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  await getWsTransport().send<void>("rename_path", { from: oldPath, to: newPath });
}
