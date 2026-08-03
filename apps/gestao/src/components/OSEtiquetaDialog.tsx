import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ETIQUETA_ALTURA_MM,
  ETIQUETA_LARGURA_MM,
  gerarEImprimirEtiquetaOS,
  gerarQrEtiquetaOS,
  renderEtiquetaOSDataUrl,
  type EtiquetaOSOpts,
} from "@/lib/os-etiqueta";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  os: EtiquetaOSOpts | null;
};

/**
 * Preview visual da etiqueta (mesma imagem do canvas) + impressão.
 */
export function OSEtiquetaDialog({ open, onOpenChange, os }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open || !os) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setPreviewUrl(null);

    (async () => {
      try {
        const qrDataUrl = await gerarQrEtiquetaOS(os.codigoBike);
        const url = await renderEtiquetaOSDataUrl({ ...os, qrDataUrl });
        if (!cancelled) setPreviewUrl(url);
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          toast.error("Não foi possível montar a etiqueta");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, os]);

  /** Imprime a mesma imagem do preview. */
  async function handlePrint() {
    if (!os || busy || printing) return;
    setPrinting(true);
    try {
      const qrDataUrl = await gerarQrEtiquetaOS(os.codigoBike);
      await gerarEImprimirEtiquetaOS({ ...os, qrDataUrl });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Etiqueta da OS ({ETIQUETA_LARGURA_MM}×{ETIQUETA_ALTURA_MM} mm)
          </DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-lg border bg-neutral-100 p-2">
            <div
              className="relative mx-auto w-full overflow-hidden rounded bg-white shadow-sm"
              style={{ aspectRatio: `${ETIQUETA_LARGURA_MM} / ${ETIQUETA_ALTURA_MM}` }}
            >
              {busy || !previewUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt={`Etiqueta ${os.numero}`}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => void handlePrint()} disabled={!os || busy || printing}>
            {printing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}{" "}
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
