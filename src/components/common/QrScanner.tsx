import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, SwitchCamera } from "lucide-react";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
}

export function QrScanner({ open, onClose, onScan }: QrScannerProps) {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const scannerId = "qr-scanner-container";
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        // Get available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);

          scanner = new Html5Qrcode(scannerId);
          scannerRef.current = scanner;

          // Prefer back camera on mobile
          const backCameraIndex = devices.findIndex(
            (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
          );
          const cameraIndex = backCameraIndex >= 0 ? backCameraIndex : 0;
          setCurrentCameraIndex(cameraIndex);

          await scanner.start(
            devices[cameraIndex].id,
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
              aspectRatio: 1,
            },
            (decodedText) => {
              onScan(decodedText);
              handleClose();
            },
            () => {
              // Ignore scan failures
            }
          );
          setError(null);
        } else {
          setError(t("settings.serverConnection.noCameraFound"));
        }
      } catch (err) {
        console.error("QR Scanner error:", err);
        setError(t("settings.serverConnection.cameraAccessDenied"));
      }
    };

    startScanner();

    return () => {
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [open, onScan, t]);

  const handleClose = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error("Error stopping scanner:", e);
      }
    }
    onClose();
  };

  const handleSwitchCamera = async () => {
    if (!scannerRef.current || cameras.length < 2) return;

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const nextIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextIndex);

      await scannerRef.current.start(
        cameras[nextIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          onScan(decodedText);
          handleClose();
        },
        () => {}
      );
    } catch (err) {
      console.error("Failed to switch camera:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            {t("settings.serverConnection.scanQrCode")}
          </DialogTitle>
        </DialogHeader>

        <div className="relative" ref={containerRef}>
          <div
            id="qr-scanner-container"
            className="w-full aspect-square bg-black"
          />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center p-4">
              <div>
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Camera switch button */}
          {cameras.length > 1 && !error && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-4 right-4 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur"
              onClick={handleSwitchCamera}
            >
              <SwitchCamera className="w-5 h-5 text-white" />
            </Button>
          )}
        </div>

        <div className="p-4 pt-2">
          <p className="text-xs text-muted-foreground text-center mb-3">
            {t("settings.serverConnection.scanQrCodeHint")}
          </p>
          <Button variant="outline" className="w-full" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
