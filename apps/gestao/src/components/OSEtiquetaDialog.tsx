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
import { gerarZplEtiquetaOS } from "@/lib/os-etiqueta-zpl";
import { imprimirZplViaQz } from "@/lib/qz-print";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  os: EtiquetaOSOpts | null;
  /** dupla | simples | pequena */
  formato?: FormatoEtiquetaOS;
};

/**
 * Preview da etiqueta + impressão (ZPL via QZ Tray; fallback navegador).
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
  const horizontal = spec.layout === "linha";

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

  /**
   * Impressão: ZPL → QZ Tray; se indisponível, fallback do navegador.
   */
  async function handlePrint() {
    if (!os || busy || printing) return;
    setPrinting(true);
    try {
      const zpl = gerarZplEtiquetaOS(os, formato);
      const result = await imprimirZplViaQz(zpl);

      if (result.ok) {
        toast.success(`Enviado para ${result.printer}`);
        return;
      }

      toast.message(result.message);
      const qrDataUrl = await gerarQrEtiquetaOS(os.numero);
      await gerarEImprimirEtiquetaOS({ ...os, qrDataUrl, formato });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    } finally {
      setPrinting(false);
    }
  }

  /** Título curto: só OS + tamanho (sem texto ZPL/explicações). */
  const titulo =
    formato === "pequena"
      ? `OS (${spec.larguraMm}×${spec.alturaViaMm} dupla)`
      : formato === "simples"
        ? `OS (${spec.larguraMm}×${spec.alturaViaMm})`
        : `OS (${spec.folhaLarguraMm}×${spec.folhaAlturaMm} dupla)`;

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
              className="mx-auto flex w-full flex-col overflow-hidden rounded bg-neutral-200 shadow-sm"
              style={{
                aspectRatio: `${spec.folhaLarguraMm} / ${spec.folhaAlturaMm}`,
              }}
            >
              <div
                className={`flex min-h-0 w-full ${horizontal ? "flex-row" : "flex-col"}`}
                style={{
                  flex: `${spec.alturaViaMm} 0 0`,
                  gap:
                    spec.gapMm > 0
                      ? `${(spec.gapMm / spec.folhaLarguraMm) * 100}%`
                      : undefined,
                }}
              >
                {busy || !previewUrl ? (
                  <div className="flex flex-1 items-center justify-center bg-white">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  Array.from({ length: spec.vias }, (_, i) => (
                    <div
                      key={i}
                      className={`relative overflow-hidden bg-white ${
                        horizontal ? "h-full" : "w-full"
                      }`}
                      style={{
                        aspectRatio: `${spec.larguraMm} / ${spec.alturaViaMm}`,
                        flex: horizontal ? `${spec.larguraMm} 0 0` : "1 1 0",
                        width: horizontal ? undefined : "100%",
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
              {spec.gapVMm > 0 && (
                <div
                  className="w-full shrink-0 bg-neutral-200"
                  style={{ flex: `${spec.gapVMm} 0 0` }}
                  aria-hidden
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
