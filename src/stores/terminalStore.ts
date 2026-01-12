import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import * as terminalService from "@/services/terminalService";

export interface TerminalInfo {
  id: string;
  working_dir: string;
}

export interface TerminalOutput {
  terminal_id: string;
  data: string;
}

interface TerminalState {
  terminals: TerminalInfo[];
  activeTerminalId: string | null;
  isTerminalPanelOpen: boolean;
}

interface TerminalActions {
  createTerminal: (workingDir: string, cols: number, rows: number) => Promise<string>;
  writeTerminal: (terminalId: string, data: string) => Promise<void>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<void>;
  killTerminal: (terminalId: string) => Promise<void>;
  listTerminals: () => Promise<void>;
  setActiveTerminal: (terminalId: string | null) => void;
  setTerminalPanelOpen: (open: boolean) => void;
  toggleTerminalPanel: () => void;
  addTerminal: (terminal: TerminalInfo) => void;
  removeTerminal: (terminalId: string) => void;
}

type TerminalStore = TerminalState & TerminalActions;

export const useTerminalStore = create<TerminalStore>()(
  immer((set, _get) => ({
    terminals: [],
    activeTerminalId: null,
    isTerminalPanelOpen: false,

    createTerminal: async (workingDir: string, cols: number, rows: number) => {
      const terminalId = await terminalService.createTerminal(workingDir, cols, rows);

      const terminal: TerminalInfo = {
        id: terminalId,
        working_dir: workingDir,
      };

      set((state) => {
        state.terminals.push(terminal);
        state.activeTerminalId = terminalId;
        state.isTerminalPanelOpen = true;
      });

      return terminalId;
    },

    writeTerminal: async (terminalId: string, data: string) => {
      await terminalService.writeTerminal(terminalId, data);
    },

    resizeTerminal: async (terminalId: string, cols: number, rows: number) => {
      await terminalService.resizeTerminal(terminalId, cols, rows);
    },

    killTerminal: async (terminalId: string) => {
      await terminalService.killTerminal(terminalId);
      set((state) => {
        state.terminals = state.terminals.filter((t) => t.id !== terminalId);
        if (state.activeTerminalId === terminalId) {
          state.activeTerminalId = state.terminals[0]?.id ?? null;
        }
        if (state.terminals.length === 0) {
          state.isTerminalPanelOpen = false;
        }
      });
    },

    listTerminals: async () => {
      const terminals = await terminalService.listTerminals();
      set((state) => {
        state.terminals = terminals;
      });
    },

    setActiveTerminal: (terminalId: string | null) => {
      set((state) => {
        state.activeTerminalId = terminalId;
      });
    },

    setTerminalPanelOpen: (open: boolean) => {
      set((state) => {
        state.isTerminalPanelOpen = open;
      });
    },

    toggleTerminalPanel: () => {
      set((state) => {
        state.isTerminalPanelOpen = !state.isTerminalPanelOpen;
      });
    },

    addTerminal: (terminal: TerminalInfo) => {
      set((state) => {
        state.terminals.push(terminal);
        if (!state.activeTerminalId) {
          state.activeTerminalId = terminal.id;
        }
      });
    },

    removeTerminal: (terminalId: string) => {
      set((state) => {
        state.terminals = state.terminals.filter((t) => t.id !== terminalId);
        if (state.activeTerminalId === terminalId) {
          state.activeTerminalId = state.terminals[0]?.id ?? null;
        }
      });
    },
  }))
);

// Re-export terminal service functions
export const setupTerminalOutputListener = terminalService.setupTerminalOutputListener;
export const registerTerminalOutputCallback = terminalService.registerTerminalOutputCallback;
export const cleanupTerminalOutputListener = terminalService.cleanupTerminalOutputListener;
