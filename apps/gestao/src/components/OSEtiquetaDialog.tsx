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
 * Preview 80mm (rolo contínuo) do comprovante de entrada da OS + impressão sem popup.
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

  /** Dispara impressão da etiqueta 80mm via iframe oculto. */
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
          <DialogTitle>Etiqueta da OS (80 mm)</DialogTitle>
        </DialogHeader>

        {!os ? (
          <p className="text-sm text-muted-foreground">OS não selecionada.</p>
        ) : (
          <div className="mx-auto w-full max-w-[302px] rounded-xl border bg-white px-3 py-3 text-black shadow-sm">
            <p className="text-base font-extrabold leading-tight tracking-wide">
              BikeTime
            </p>
            <p className="text-[11px] text-neutral-600">Comprovante de entrada</p>

            <div className="mt-2 flex items-start justify-between gap-2 border-b border-neutral-900 pb-2">
              <div className="min-w-0 space-y-1">
                <p className="font-mono text-lg font-extrabold leading-none">
                  {os.numero}
                </p>
                <p className="text-[11px]">
                  <span className="font-semibold">Cliente:</span> {os.clienteNome || "—"}
                </p>
                <p className="text-[11px]">
                  <span className="font-semibold">Bike:</span> {bike}
                </p>
                {os.codigoBike ? (
                  <p className="text-[11px]">
                    <span className="font-semibold">Código:</span> {os.codigoBike}
                  </p>
                ) : null}
              </div>
              {busy ? (
                <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR ${os.codigoBike}`}
                  className="h-[84px] w-[84px] shrink-0"
                />
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
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

            <div className="mt-3 space-y-2 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Problema / serviço
                </p>
                <p className="whitespace-pre-wrap">
                  {(os.problemaRelatado ?? "").trim() || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  Checklist / acessórios
                </p>
                <p className="whitespace-pre-wrap">{checklist}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-neutral-300 pt-3 text-[10px] leading-snug text-neutral-700">
              <p>
                Acompanhe a jornada da sua bike: acesse biketime.com.br, faça login
                com seu e-mail e veja o status na oficina.
              </p>
              <p className="mt-1.5 font-semibold italic text-neutral-900">
                It&apos;s Bike Time, sua oficina premium em Perdizes.
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
