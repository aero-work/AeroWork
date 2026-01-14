import { useEffect, useState, useCallback } from "react";

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const STORAGE_KEY = "aero-code-zoom";

export function useZoom() {
  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : 1.0;
  });

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1.0);
  }, []);

  // Apply zoom to document
  useEffect(() => {
    document.documentElement.style.zoom = `${zoom}`;
    localStorage.setItem(STORAGE_KEY, zoom.toString());
  }, [zoom]);

  // Handle keyboard shortcuts
  useEffect(() => {
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
  }, [zoomIn, zoomOut, resetZoom]);

  return { zoom, zoomIn, zoomOut, resetZoom };
}
