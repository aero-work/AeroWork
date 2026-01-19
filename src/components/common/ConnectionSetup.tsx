import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/stores/settingsStore";
import { isDesktopApp, getWebSocketEndpoint } from "@/services/transport";
import { QrScanner } from "@/components/common/QrScanner";
import { Wifi, ScanLine, Loader2 } from "lucide-react";

interface ConnectionSetupProps {
  onConnect?: () => void;
  isConnecting?: boolean;
}

export function ConnectionSetup({ onConnect, isConnecting }: ConnectionSetupProps) {
  const { t } = useTranslation();
  const wsUrl = useSettingsStore((state) => state.wsUrl);
  const setWsUrl = useSettingsStore((state) => state.setWsUrl);

  const [inputWsUrl, setInputWsUrl] = useState(wsUrl || "");
  const [showQrScanner, setShowQrScanner] = useState(false);

  const currentWsEndpoint = getWebSocketEndpoint();
  const isDesktop = isDesktopApp();
  const isMobile = !isDesktop && typeof window !== "undefined" && window.innerWidth < 768;

  const handleConnect = () => {
    if (inputWsUrl && inputWsUrl !== wsUrl) {
      setWsUrl(inputWsUrl);
      // Reload to apply new URL
      window.location.reload();
    } else if (onConnect) {
      onConnect();
    }
  };

  const handleQrScan = (result: string) => {
    setInputWsUrl(result);
    setShowQrScanner(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo/Icon */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Wifi className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">
            <span style={{ fontFamily: 'Quantico, sans-serif', fontStyle: 'italic' }}>
              Aero Work
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("connection.setupDescription")}
          </p>
        </div>

        {/* Connection form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-url" className="text-sm">
              {t("settings.serverConnection.wsUrl")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="ws-url"
                value={inputWsUrl}
                onChange={(e) => setInputWsUrl(e.target.value)}
                placeholder={currentWsEndpoint || t("settings.serverConnection.wsUrlPlaceholder")}
                className="font-mono text-sm"
              />
              {isMobile && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowQrScanner(true)}
                  className="flex-shrink-0"
                  title={t("settings.serverConnection.scanQrCode")}
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              )}
            </div>
            {currentWsEndpoint && !wsUrl && (
              <p className="text-xs text-muted-foreground">
                {t("common.current")}: {currentWsEndpoint}
              </p>
            )}
          </div>

          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("connection.connecting")}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                {t("connection.connect")}
              </>
            )}
          </Button>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground text-center">
          {t("connection.setupHint")}
        </p>
      </div>

      {/* QR Scanner Dialog */}
      <QrScanner
        open={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScan={handleQrScan}
      />
    </div>
  );
}
