import { useEffect, useState, useCallback } from "react";

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const STORAGE_KEY = "aero-code-zoom";

// Detect if running in Tauri desktop app
function isTauriApp(): boolean {
  if (typeof window !== "undefined") {
    const win = window as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
    return !!(win.__TAURI__ || win.__TAURI_INTERNALS__);
  }
  return false;
}

/**
 * Custom zoom hook for desktop app only.
 * In web browser mode, this hook does nothing - users should use browser's native zoom.
 */
export function useZoom() {
  const isDesktop = isTauriApp();

  const [zoom, setZoom] = useState(() => {
    if (!isDesktop) return 1.0;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : 1.0;
  });

  const zoomIn = useCallback(() => {
    if (!isDesktop) return;
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, [isDesktop]);

  const zoomOut = useCallback(() => {
    if (!isDesktop) return;
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, [isDesktop]);

  const resetZoom = useCallback(() => {
    if (!isDesktop) return;
    setZoom(1.0);
  }, [isDesktop]);

  // Apply zoom to document (desktop only)
  useEffect(() => {
    if (!isDesktop) return;
    document.documentElement.style.zoom = `${zoom}`;
    localStorage.setItem(STORAGE_KEY, zoom.toString());
  }, [zoom, isDesktop]);

  // Handle keyboard shortcuts (desktop only)
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (!modifier) return;

      // Cmd/Ctrl + Plus (= key or numpad +)
      if (e.key === "=" || e.key === "+" || e.code === "NumpadAdd") {
        e.preventDefault();
        zoomIn();
      }
      // Cmd/Ctrl + Minus
      else if (e.key === "-" || e.code === "NumpadSubtract") {
        e.preventDefault();
        zoomOut();
      }
      // Cmd/Ctrl + 0 (reset)
      else if (e.key === "0" || e.code === "Numpad0") {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDesktop, zoomIn, zoomOut, resetZoom]);

  return { zoom, zoomIn, zoomOut, resetZoom };
}
