import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, QrCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { interpretarQrScan } from "@/lib/bike-qr-scan";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const READER_ID = "bt-bike-qr-reader";

/**
 * Scanner de QR (somente gestão / mobile).
 * Adesivo bike → `/b/{codigo}`; etiqueta OS → `/os/{numero}`.
 */
export function BikeQrScanDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    handledRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    /** Para e limpa a câmera do scanner. */
    async function stopScanner() {
      scannerRef.current = null;
      if (!scanner) return;
      const s = scanner;
      scanner = null;
      try {
        if (s.isScanning) await s.stop();
      } catch {
        /* ignore */
      }
      try {
        s.clear();
      } catch {
        /* ignore */
      }
    }

    /** Ao ler um QR válido, fecha e abre bike ou OS. */
    async function onDecoded(text: string) {
      if (handledRef.current || cancelled) return;
      const target = interpretarQrScan(text);
      if (!target) {
        toast.error("QR inválido. Use o adesivo da bike ou a etiqueta da OS.");
        return;
      }
      handledRef.current = true;
      await stopScanner();
      onOpenChange(false);
      if (target.kind === "os") {
        navigate({ to: "/os/$numero", params: { numero: target.numero } });
      } else {
        navigate({ to: "/b/$codigo", params: { codigo: target.codigo } });
      }
    }

    /** Aguarda o Dialog montar o #reader antes de iniciar a câmera. */
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        const el = document.getElementById(READER_ID);
        if (!el) {
          setStarting(false);
          setError("Área da câmera indisponível. Tente novamente.");
          return;
        }

        try {
          scanner = new Html5Qrcode(READER_ID);
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
            (decoded) => {
              void onDecoded(decoded);
            },
            () => {
              /* frames sem QR — ignora */
            },
          );
          if (cancelled) {
            await stopScanner();
            return;
          }
          setStarting(false);
        } catch (e) {
          if (cancelled) return;
          setStarting(false);
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir a câmera. Verifique a permissão.",
          );
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void stopScanner();
    };
  }, [open, navigate, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Ler QR da bike
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o adesivo da bike ou a etiqueta da OS.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg border bg-black">
          <div id={READER_ID} className="min-h-[280px] w-full [&_video]:w-full" />
          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Abrindo câmera…</p>
            </div>
          )}
        </div>

        {error && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
