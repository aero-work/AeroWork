import { useState, useEffect, useCallback } from "react";
import { X, Share, PlusSquare, Download, Smartphone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Detect if running in Tauri app (desktop or mobile)
function isTauriApp(): boolean {
  const win = window as { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown };
  return !!(win.__TAURI__ || win.__TAURI_INTERNALS__);
}

// Detect if running on mobile
function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Detect Android Chrome
function isAndroidChrome(): boolean {
  const ua = navigator.userAgent;
  return /Android/.test(ua) && /Chrome/.test(ua);
}

// Detect iOS Safari
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  return isIOSDevice && isSafari;
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptType, setPromptType] = useState<"native" | "ios" | "android-manual">("native");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show in Tauri app (desktop or Android app)
    if (isTauriApp()) return;

    // Only show on mobile devices in browser
    if (!isMobile()) return;

    // Check if dismissed recently (within 7 days)
    const dismissedAt = localStorage.getItem("pwa-install-dismissed");
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const daysSinceDismissed =
        (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone;
    if (isStandalone) return;

    // iOS Safari - show manual instructions
    if (isIOSSafari()) {
      setPromptType("ios");
      setTimeout(() => setShowPrompt(true), 3000);
      return;
    }

    // Listen for native install prompt (HTTPS only)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPromptType("native");
      setTimeout(() => setShowPrompt(true), 3000);
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleAppInstalled);

    // For HTTP on Android Chrome, show manual instructions after delay
    // (beforeinstallprompt won't fire on HTTP)
    const isHTTP = window.location.protocol === "http:";
    if (isHTTP && isAndroidChrome()) {
      setTimeout(() => {
        // Only show if native prompt didn't fire
        if (!deferredPrompt) {
          setPromptType("android-manual");
          setShowPrompt(true);
        }
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setShowPrompt(false);
      }
    } catch (err) {
      console.error("Install prompt error:", err);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    // Remember dismissal with timestamp (will show again after 7 days)
    localStorage.setItem("pwa-install-dismissed", Date.now().toString());
  }, []);

  if (!showPrompt) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-4 right-4 z-50",
        "bg-card border border-border rounded-xl shadow-lg",
        "p-4 animate-in slide-in-from-bottom-4 duration-300",
        "md:left-auto md:right-4 md:bottom-4 md:max-w-sm"
      )}
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-semibold text-sm text-foreground">
            Install Aero Work
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {promptType === "native"
              ? "Install for quick access and offline support"
              : "Add to home screen for quick access"}
          </p>
        </div>
      </div>

      {promptType === "ios" ? (
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <ol className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                1
              </span>
              <span className="flex items-center gap-1">
                Tap <Share className="h-4 w-4 inline text-primary" /> Share
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                2
              </span>
              <span className="flex items-center gap-1">
                Select <PlusSquare className="h-4 w-4 inline text-primary" />{" "}
                Add to Home Screen
              </span>
            </li>
          </ol>
        </div>
      ) : promptType === "android-manual" ? (
        <div className="mt-3 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          <ol className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                1
              </span>
              <span className="flex items-center gap-1">
                Tap <MoreVertical className="h-4 w-4 inline text-primary" /> Menu (top right)
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium">
                2
              </span>
              <span className="flex items-center gap-1">
                Select "Add to Home screen"
              </span>
            </li>
          </ol>
          <p className="mt-2 text-[10px] text-muted-foreground/70">
            For standalone app mode, enable HTTPS or use Chrome flags
          </p>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            className="flex-1"
          >
            Not now
          </Button>
          <Button size="sm" onClick={handleInstall} className="flex-1 gap-1.5">
            <Download className="w-4 h-4" />
            Install
          </Button>
        </div>
      )}
    </div>
  );
}
