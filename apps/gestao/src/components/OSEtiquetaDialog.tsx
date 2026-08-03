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
 * Preview 100×150mm do comprovante de entrada da OS + impressão sem popup.
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

  /** Dispara impressão da etiqueta 100×150mm via iframe oculto. */
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
          <DialogTitle>Etiqueta da OS (100×150 mm)</DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div
            className="mx-auto overflow-hidden rounded-lg border bg-white text-black shadow-sm"
            style={{ width: 320, height: 480, paddingTop: 16, paddingRight: 8, paddingBottom: 16, paddingLeft: 8 }}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-900 pb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-extrabold leading-none tracking-wide">
                    BikeTime
                  </p>
                  <p className="mt-1 text-xs text-neutral-600">Comprovante de entrada</p>
                  <p className="mt-3 font-mono text-2xl font-extrabold leading-none">
                    {os.numero}
                  </p>
                  <p className="mt-1.5 text-xs">
                    <span className="font-semibold">Cliente:</span> {os.clienteNome || "—"}
                  </p>
                  <p className="mt-1 text-xs">
                    <span className="font-semibold">Bike:</span> {bike}
                  </p>
                  {os.codigoBike ? (
                    <p className="mt-1 text-xs">
                      <span className="font-semibold">Código:</span> {os.codigoBike}
                    </p>
                  ) : null}
                </div>
                {busy ? (
                  <div className="flex h-[102px] w-[102px] shrink-0 items-start justify-center pt-0 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR ${os.codigoBike}`}
                    className="h-[102px] w-[102px] shrink-0 self-start"
                  />
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    Entrada
                  </p>
                  <p>{formatarDataEtiqueta(os.dataEntrada)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    Previsão
                  </p>
                  <p>{formatarDataEtiqueta(os.dataPrevista)}</p>
                </div>
              </div>

              <div className="mt-3 min-w-0 space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    Problema / serviço
                  </p>
                  <p className="line-clamp-6 whitespace-pre-wrap">
                    {(os.problemaRelatado ?? "").trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    Checklist / acessórios
                  </p>
                  <p className="line-clamp-6 whitespace-pre-wrap">{checklist}</p>
                </div>
              </div>

              <div className="mt-auto border-t border-neutral-300 pt-3 text-[11px] leading-snug text-neutral-700">
                <p>
                  Acompanhe a jornada da sua bike: acesse biketime.com.br, faça login
                  com seu e-mail e veja o status na oficina.
                </p>
                <p className="mt-1.5 font-semibold italic text-neutral-900">
                  It&apos;s Bike Time, sua oficina premium em Perdizes.
                </p>
              </div>
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
