import { useState, useEffect } from "react";

/**
 * Hook to detect virtual keyboard height on mobile devices.
 * Uses the Visual Viewport API to detect when the keyboard appears
 * and calculate its height.
 *
 * On Android WebView, windowSoftInputMode="adjustResize" often doesn't work
 * properly with modern browsers. This hook provides a workaround by
 * listening to visualViewport resize events.
 *
 * @returns keyboardHeight - The current keyboard height in pixels (0 when hidden)
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    // Only run on touch devices (mobile)
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    // Store initial viewport height
    let initialHeight = viewport.height;

    const handleResize = () => {
      // When keyboard appears, viewport height decreases
      // Calculate keyboard height as the difference
      const currentHeight = viewport.height;

      // Update initial height if it increases (e.g., after orientation change)
      if (currentHeight > initialHeight) {
        initialHeight = currentHeight;
      }

      const height = Math.max(0, initialHeight - currentHeight);

      // Only update if significant change (> 100px) to avoid false positives
      // from browser chrome changes
      if (height > 100) {
        setKeyboardHeight(height);
      } else {
        setKeyboardHeight(0);
      }
    };

    // Handle scroll to ensure input stays visible
    const handleScroll = () => {
      // On some Android devices, we need to scroll the active element into view
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")
      ) {
        // Small delay to let the viewport settle
        setTimeout(() => {
          activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    };

    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleScroll);

    // Initial check
    handleResize();

    return () => {
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return keyboardHeight;
}
