"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";

import { Button } from "@/components/ui/button";

interface QrScannerProps {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
}

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const [active, setActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // camera may already be stopped
      }
      scannerRef.current = null;
    }
    setActive(false);
    handledRef.current = false;
  }, []);

  const startScanner = async () => {
    handledRef.current = false;
    const scanner = new Html5Qrcode("kiosk-qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onScan(decoded);
          void stopScanner();
        },
        () => undefined,
      );
      setActive(true);
    } catch {
      onError?.("Could not access camera. Enter child code manually or allow camera permission.");
      await stopScanner();
    }
  };

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-3">
      <div
        id="kiosk-qr-reader"
        className={`overflow-hidden rounded-xl border bg-black/5 ${active ? "min-h-[260px]" : "hidden"}`}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => (active ? void stopScanner() : void startScanner())}
      >
        {active ? (
          <>
            <CameraOff className="mr-2 h-4 w-4" />
            Stop camera
          </>
        ) : (
          <>
            <Camera className="mr-2 h-4 w-4" />
            Scan child QR code
          </>
        )}
      </Button>
    </div>
  );
}
