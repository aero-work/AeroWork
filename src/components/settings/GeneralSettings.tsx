import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAgentStore } from "@/stores/agentStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { languages, supportedLanguages } from "@/i18n";
import { getWebSocketEndpoint, isDesktopApp } from "@/services/transport";
import { getTransport } from "@/services/transport";
import { Copy, QrCode, Check, Wifi, ScanLine } from "lucide-react";
import { QrScanner } from "@/components/common/QrScanner";
import type { ServerInfo } from "@/services/transport";

export function GeneralSettings() {
  const { t } = useTranslation();
  const autoConnect = useSettingsStore((state) => state.autoConnect);
  const showHiddenFiles = useSettingsStore((state) => state.showHiddenFiles);
  const theme = useSettingsStore((state) => state.theme);
  const autoCleanEmptySessions = useSettingsStore((state) => state.autoCleanEmptySessions);
  const language = useSettingsStore((state) => state.language);
  const wsUrl = useSettingsStore((state) => state.wsUrl);
  const setAutoConnect = useSettingsStore((state) => state.setAutoConnect);
  const setShowHiddenFiles = useSettingsStore((state) => state.setShowHiddenFiles);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const setAutoCleanEmptySessions = useSettingsStore((state) => state.setAutoCleanEmptySessions);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const setWsUrl = useSettingsStore((state) => state.setWsUrl);

  const connectionStatus = useAgentStore((state) => state.connectionStatus);
  const isConnected = connectionStatus === "connected";

  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [inputWsUrl, setInputWsUrl] = useState(wsUrl || "");

  const currentWsEndpoint = getWebSocketEndpoint();
  const isMobile = !isDesktopApp() && typeof window !== "undefined" && window.innerWidth < 768;

  // Fetch server info when connected
  useEffect(() => {
    if (isConnected) {
      const transport = getTransport();
      transport.request<ServerInfo>("get_server_info")
        .then((info) => {
          console.log("Server info:", info);
          setServerInfo(info);
          if (info.lanAddresses && info.lanAddresses.length > 0) {
            // Select first LAN address (not localhost) by default
            const lanAddress = info.lanAddresses.find(addr => !addr.includes("127.0.0.1")) || info.lanAddresses[0];
            setSelectedAddress(lanAddress);
          }
        })
        .catch((err) => {
          console.error("Failed to get server info:", err);
        });
    } else {
      setServerInfo(null);
    }
  }, [isConnected]);

  // Debug log
  useEffect(() => {
    console.log("GeneralSettings state:", { isConnected, connectionStatus, serverInfo, selectedAddress });
  }, [isConnected, connectionStatus, serverInfo, selectedAddress]);

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveWsUrl = () => {
    setWsUrl(inputWsUrl || null);
    // Reload the page to apply new WS URL
    window.location.reload();
  };

  const handleQrScan = (result: string) => {
    // Set the scanned URL to input
    setInputWsUrl(result);
    setShowQrScanner(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t("settings.general")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="space-y-4">
        {/* Server Connection - Always show */}
        <div className="rounded-lg border p-3 sm:p-4 space-y-4">
          <div className="space-y-0.5">
            <Label className="text-sm sm:text-base flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              {t("settings.serverConnection.title")}
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.serverConnection.description")}
            </p>
          </div>

          {/* WS URL input - available for both desktop and web */}
          <div className="space-y-2">
            <Label className="text-sm">{t("settings.serverConnection.wsUrl")}</Label>
            <div className="flex gap-2">
              <Input
                value={inputWsUrl}
                onChange={(e) => setInputWsUrl(e.target.value)}
                placeholder={currentWsEndpoint || t("settings.serverConnection.wsUrlPlaceholder")}
                className="font-mono text-sm"
              />
              {/* QR Scan button - only show on mobile/web */}
              {isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQrScanner(true)}
                  className="flex-shrink-0"
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
              )}
              <Button onClick={handleSaveWsUrl} size="sm">
                {t("common.save")}
              </Button>
            </div>
            {currentWsEndpoint && !wsUrl && (
              <p className="text-xs text-muted-foreground">
                {t("common.current")}: {currentWsEndpoint}
              </p>
            )}
          </div>

          {/* LAN Addresses */}
          {isConnected && serverInfo?.lanAddresses && serverInfo.lanAddresses.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">{t("settings.serverConnection.lanAddresses")}</Label>
              <div className="flex flex-wrap gap-2">
                {serverInfo.lanAddresses.map((address) => (
                  <div
                    key={address}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors text-sm ${
                      selectedAddress === address
                        ? "bg-primary/10 border border-primary/30"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                    onClick={() => setSelectedAddress(address)}
                  >
                    <code className="font-mono text-xs">{address}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAddress(address);
                      }}
                    >
                      {copiedAddress === address ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QR Code */}
          {isConnected && selectedAddress && (
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQrCode(!showQrCode)}
                className="gap-2"
              >
                <QrCode className="h-4 w-4" />
                {showQrCode
                  ? t("settings.serverConnection.hideQrCode")
                  : t("settings.serverConnection.showQrCode")}
              </Button>

              {showQrCode && (
                <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={selectedAddress}
                    size={200}
                    level="M"
                    includeMargin
                  />
                  <p className="text-xs text-gray-600 text-center">
                    {t("settings.serverConnection.scanToConnect")}
                  </p>
                  <code className="text-xs text-gray-500 font-mono">
                    {selectedAddress}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Not connected message */}
          {!isConnected && (
            <p className="text-sm text-muted-foreground">
              {t("settings.serverConnection.noServer")}
            </p>
          )}
        </div>

        {/* Language */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:p-4">
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm sm:text-base">{t("settings.language.title")}</Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.language.description")}
            </p>
          </div>
          <Select value={language || "auto"} onValueChange={(value) => setLanguage(value === "auto" ? "" : value)}>
            <SelectTrigger className="w-[140px] sm:w-[180px] flex-shrink-0">
              <SelectValue>
                {language === "" ? t("settings.language.auto") : (languages[language] || language)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t("settings.language.auto")}</SelectItem>
              {supportedLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {languages[lang] || lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme */}
        <div className="rounded-lg border p-3 sm:p-4">
          <div className="space-y-0.5 mb-3">
            <Label className="text-sm sm:text-base">{t("settings.theme.title")}</Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.theme.description")}
            </p>
          </div>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => setTheme(themeOption)}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  theme === themeOption
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {t(`settings.theme.${themeOption}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Connect */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:p-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="auto-connect" className="text-sm sm:text-base">
              {t("settings.autoConnect.title")}
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.autoConnect.description")}
            </p>
          </div>
          <Switch
            id="auto-connect"
            checked={autoConnect}
            onCheckedChange={setAutoConnect}
            className="flex-shrink-0"
          />
        </div>

        {/* Auto Clean Empty Sessions */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:p-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="auto-clean-sessions" className="text-sm sm:text-base">
              {t("settings.autoCleanEmptySessions.title")}
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.autoCleanEmptySessions.description")}
            </p>
          </div>
          <Switch
            id="auto-clean-sessions"
            checked={autoCleanEmptySessions}
            onCheckedChange={setAutoCleanEmptySessions}
            className="flex-shrink-0"
          />
        </div>

        {/* Show Hidden Files (inverted logic: UI shows "Hide Hidden Files") */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3 sm:p-4">
          <div className="space-y-0.5 min-w-0">
            <Label htmlFor="hidden-files" className="text-sm sm:text-base">
              {t("settings.hideHiddenFiles.title")}
            </Label>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("settings.hideHiddenFiles.description")}
            </p>
          </div>
          <Switch
            id="hidden-files"
            checked={!showHiddenFiles}
            onCheckedChange={(checked) => setShowHiddenFiles(!checked)}
            className="flex-shrink-0"
          />
        </div>
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
