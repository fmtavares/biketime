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
  gerarQrDataUrl,
  htmlAdesivoBike,
  imprimirAdesivoHtml,
  urlQrBike,
  type AdesivoBikeOpts,
} from "@/lib/bike-adesivo";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bike: AdesivoBikeOpts | null;
};

/**
 * Preview do adesivo com QR gerado localmente + impressão sem popup.
 */
export function BikeAdesivoDialog({ open, onOpenChange, bike }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !bike?.codigoBike) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    gerarQrDataUrl(bike.codigoBike)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          toast.error("Não foi possível gerar o QR do adesivo");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bike?.codigoBike]);

  /** Dispara impressão do adesivo via iframe oculto. */
  function handlePrint() {
    if (!bike || !qrDataUrl) return;
    try {
      imprimirAdesivoHtml(htmlAdesivoBike({ ...bike, qrDataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao imprimir");
    }
  }

  const titulo = bike ? `${bike.marca} ${bike.modelo}`.trim() : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adesivo da bike</DialogTitle>
        </DialogHeader>

        {!bike ? (
          <p className="text-sm text-muted-foreground">Bike não selecionada.</p>
        ) : (
          <div className="mx-auto flex w-[140px] flex-col items-center gap-0.5 rounded-xl border bg-white px-2 py-3 text-center text-black">
            {busy || !qrDataUrl ? (
              <div className="flex h-[96px] w-[96px] items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : (
              <img
                src={qrDataUrl}
                alt={`QR ${bike.codigoBike}`}
                className="mb-0.5 h-[96px] w-[96px]"
              />
            )}
            <p className="font-mono text-[13px] font-bold leading-tight tracking-wide">
              {bike.codigoBike}
            </p>
            <p className="text-[11px] font-medium leading-tight">{titulo}</p>
            {bike.clienteNome ? (
              <p className="truncate text-[10px] leading-tight text-neutral-600">
                {bike.clienteNome}
              </p>
            ) : null}
          </div>
        )}

        {bike && (
          <p className="break-all text-center text-[11px] text-muted-foreground">
            {urlQrBike(bike.codigoBike)}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handlePrint} disabled={!qrDataUrl || busy}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
