import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "xterm/css/xterm.css";
import {
  useTerminalStore,
  registerTerminalOutputCallback,
  setupTerminalOutputListener,
} from "@/stores/terminalStore";

interface XTerminalProps {
  terminalId: string;
  onReady?: () => void;
}

export function XTerminal({ terminalId, onReady }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const writeTerminal = useTerminalStore((state) => state.writeTerminal);
  const resizeTerminal = useTerminalStore((state) => state.resizeTerminal);

  // Handle resize
  const handleResize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current) {
      try {
        fitAddonRef.current.fit();
        const { cols, rows } = terminalRef.current;
        resizeTerminal(terminalId, cols, rows);
      } catch {
        // ignore resize errors during cleanup
      }
    }
  }, [terminalId, resizeTerminal]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup terminal output listener
    setupTerminalOutputListener();

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      allowProposedApi: true,
    });

    terminalRef.current = terminal;

    // Create and load addons
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    terminal.loadAddon(fitAddon);

    // Open terminal in container
    terminal.open(containerRef.current);

    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
    } catch {
      // WebGL not supported, fall back to canvas renderer
    }

    // Fit terminal to container after a short delay to ensure DOM is ready
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore fit errors during initial render
      }
    });

    // Handle user input
    terminal.onData((data) => {
      writeTerminal(terminalId, data);
    });

    // Register output callback
    const unregister = registerTerminalOutputCallback(terminalId, (data) => {
      terminal.write(data);
    });

    // Setup resize observer with debounce
    let resizeTimeout: number | undefined;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        handleResize();
      }, 50);
    });
    resizeObserver.observe(containerRef.current);

    // Focus terminal
    terminal.focus();

    if (onReady) {
      onReady();
    }

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      unregister();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId, writeTerminal, handleResize, onReady]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [handleResize]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#1e1e1e]"
      style={{ padding: "4px" }}
    />
  );
}
