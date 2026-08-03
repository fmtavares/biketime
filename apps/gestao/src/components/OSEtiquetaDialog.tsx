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
  formatarDataEtiqueta,
  gerarQrEtiquetaOS,
  htmlEtiquetaOS,
  imprimirEtiquetaOS,
  textoChecklistEtiqueta,
  tituloBikeEtiqueta,
  type EtiquetaOSOpts,
} from "@/lib/os-etiqueta";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  os: EtiquetaOSOpts | null;
};

/**
 * Preview 76×76mm do comprovante de entrada da OS + impressão sem popup.
 */
export function OSEtiquetaDialog({ open, onOpenChange, os }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !os) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    gerarQrEtiquetaOS(os.codigoBike)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          toast.error("Não foi possível gerar o QR da bike");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, os?.codigoBike, os?.numero]);

  /** Dispara impressão da etiqueta 76×76mm via iframe oculto. */
  function handlePrint() {
    if (!os || busy) return;
    try {
      imprimirEtiquetaOS(htmlEtiquetaOS({ ...os, qrDataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    }
  }

  const bike = os ? tituloBikeEtiqueta(os) : "";
  const checklist = os ? textoChecklistEtiqueta(os.checklistEntrada) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Etiqueta da OS (76×76 mm)</DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div
            className="mx-auto overflow-hidden rounded-lg border bg-white text-black shadow-sm"
            style={{ width: 287, height: 287, padding: 8 }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-2 border-b border-neutral-900 pb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold leading-none tracking-wide">
                    BikeTime
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-600">Comprovante de entrada</p>
                  <p className="mt-1.5 font-mono text-base font-extrabold leading-none">
                    {os.numero}
                  </p>
                  <p className="mt-1 truncate text-[10px]">
                    <span className="font-semibold">Cliente:</span> {os.clienteNome || "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px]">
                    <span className="font-semibold">Bike:</span> {bike}
                  </p>
                  {os.codigoBike ? (
                    <p className="mt-0.5 truncate text-[10px]">
                      <span className="font-semibold">Código:</span> {os.codigoBike}
                    </p>
                  ) : null}
                </div>
                <div className="flex w-16 shrink-0 flex-col items-center">
                  {busy ? (
                    <div className="flex h-16 w-16 items-center justify-center text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR ${os.codigoBike}`}
                      className="h-16 w-16 self-start"
                    />
                  ) : null}
                  <div className="mt-1 w-full space-y-1 text-center">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-wide text-neutral-500">
                        Entrada
                      </p>
                      <p className="text-[9px] leading-tight">
                        {formatarDataEtiqueta(os.dataEntrada)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-wide text-neutral-500">
                        Previsão
                      </p>
                      <p className="text-[9px] leading-tight">
                        {formatarDataEtiqueta(os.dataPrevista)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-1.5 min-w-0 flex-1 space-y-1.5 text-[10px]">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                    Problema / serviço
                  </p>
                  <p className="line-clamp-4 whitespace-pre-wrap">
                    {(os.problemaRelatado ?? "").trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
                    Checklist / acessórios
                  </p>
                  <p className="line-clamp-4 whitespace-pre-wrap">{checklist}</p>
                </div>
              </div>

              <p className="mt-auto truncate border-t border-neutral-300 pt-1 text-[9px] text-neutral-700">
                biketime.com.br · It&apos;s Bike Time — Perdizes
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} disabled={!os || busy}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
