import { useEffect, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
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
import {
  baixarArquivoZpl,
  gerarZplEtiquetaOS,
} from "@/lib/os-etiqueta-zpl";
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
 * Preview da etiqueta + impressão.
 * Preferência: ZPL raw via QZ Tray (Elgin L42 203 dpi). Fallback: print do navegador.
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
   * Impressão profissional: ZPL → QZ Tray → térmica.
   * Se QZ não estiver disponível, oferece .zpl e fallback no navegador.
   */
  async function handlePrint() {
    if (!os || busy || printing) return;
    setPrinting(true);
    try {
      const zpl = gerarZplEtiquetaOS(os, formato);
      const result = await imprimirZplViaQz(zpl);

      if (result.ok) {
        toast.success(`Enviado via ZPL para ${result.printer}`);
        return;
      }

      // Sem QZ: baixa .zpl e tenta print do navegador (preview)
      baixarArquivoZpl(zpl, `${os.numero}-${formato}`);
      toast.message(result.message, {
        description:
          "Baixamos o arquivo .zpl. Com QZ Tray, a impressão vai direto na Elgin. Usando fallback do navegador…",
        duration: 8000,
      });

      const qrDataUrl = await gerarQrEtiquetaOS(os.numero);
      await gerarEImprimirEtiquetaOS({ ...os, qrDataUrl, formato });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    } finally {
      setPrinting(false);
    }
  }

  /** Só gera e baixa o .zpl (útil para teste no utilitário Elgin). */
  function handleDownloadZpl() {
    if (!os) return;
    const zpl = gerarZplEtiquetaOS(os, formato);
    baixarArquivoZpl(zpl, `${os.numero}-${formato}`);
    toast.success("Arquivo .zpl baixado");
  }

  const titulo =
    formato === "pequena"
      ? `OS pequena (${spec.larguraMm}×${spec.alturaViaMm} mm · ZPL 203 dpi)`
      : formato === "simples"
        ? `OS simples (${spec.larguraMm}×${spec.alturaViaMm} mm · ZPL 203 dpi)`
        : `OS dupla (${spec.folhaLarguraMm}×${spec.folhaAlturaMm} mm · ZPL 203 dpi)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div className="space-y-3">
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
            <p className="text-xs text-muted-foreground">
              Impressão térmica via <strong>ZPL</strong> (QZ Tray). Preview é só
              referência visual; na Elgin L42 o QR e o texto saem nativos em 203 dpi.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownloadZpl}
              disabled={!os || busy}
            >
              <Download className="size-4" />
              .zpl
            </Button>
            <Button onClick={() => void handlePrint()} disabled={!os || busy || printing}>
              {printing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}{" "}
              Imprimir ZPL
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
