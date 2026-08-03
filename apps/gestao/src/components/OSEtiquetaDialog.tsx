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
  gerarEImprimirEtiquetaOS,
  gerarQrEtiquetaOS,
  renderEtiquetaOSDataUrl,
  specEtiquetaOS,
  type EtiquetaOSOpts,
  type FormatoEtiquetaOS,
} from "@/lib/os-etiqueta";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  os: EtiquetaOSOpts | null;
  /** dupla = 100×150 (2 vias); simples = 78×70 (1 via). */
  formato?: FormatoEtiquetaOS;
};

/**
 * Preview visual da etiqueta (mesma imagem do canvas) + impressão.
 */
export function OSEtiquetaDialog({
  open,
  onOpenChange,
  os,
  formato = "dupla",
}: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const spec = specEtiquetaOS(formato);

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
        const qrDataUrl = await gerarQrEtiquetaOS(os.numero);
        const url = await renderEtiquetaOSDataUrl({
          ...os,
          qrDataUrl,
          formato,
        });
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
  }, [open, os, formato]);

  /** Imprime a mesma imagem do preview. */
  async function handlePrint() {
    if (!os || busy || printing) return;
    setPrinting(true);
    try {
      const qrDataUrl = await gerarQrEtiquetaOS(os.numero);
      await gerarEImprimirEtiquetaOS({ ...os, qrDataUrl, formato });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    } finally {
      setPrinting(false);
    }
  }

  const titulo =
    formato === "simples"
      ? `OS simples (${spec.larguraMm}×${spec.alturaViaMm} mm)`
      : `OS dupla (${spec.larguraMm}×${spec.folhaAlturaMm} mm · ${spec.vias} vias)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-lg border bg-neutral-100 p-2">
            <div
              className="mx-auto flex w-full flex-col overflow-hidden rounded bg-white shadow-sm"
              style={{
                aspectRatio: `${spec.larguraMm} / ${spec.folhaAlturaMm}`,
              }}
            >
              {busy || !previewUrl ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                Array.from({ length: spec.vias }, (_, i) => (
                  <div
                    key={i}
                    className="relative w-full overflow-hidden border-b border-dashed border-neutral-300 last:border-b-0"
                    style={{
                      aspectRatio: `${spec.larguraMm} / ${spec.alturaViaMm}`,
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt={`Etiqueta ${os.numero} via ${i + 1}`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </div>
                ))
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
