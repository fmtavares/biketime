import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ETIQUETA_CLIENTE_ALTURA_MM,
  ETIQUETA_CLIENTE_LARGURA_MM,
  gerarEImprimirEtiquetaCliente,
  renderEtiquetaClienteDataUrl,
  type EtiquetaClienteOpts,
} from "@/lib/cliente-etiqueta";
import { gerarZplEtiquetaCliente } from "@/lib/cliente-etiqueta-zpl";
import { imprimirZplViaQz } from "@/lib/qz-print";
import { toast } from "sonner";

export type ClienteEtiquetaAlvo = {
  nome: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: ClienteEtiquetaAlvo | null;
};

/**
 * Preview da etiqueta de cliente, referência opcional e impressão
 * (ZPL via QZ Tray; fallback do navegador). Nada é gravado no banco.
 */
export function ClienteEtiquetaDialog({ open, onOpenChange, cliente }: Props) {
  const [referencia, setReferencia] = useState("");
  const [impressoEm, setImpressoEm] = useState<Date>(() => new Date());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const sessao = open ? (cliente?.nome ?? "") : "";
  const [sessaoChave, setSessaoChave] = useState(sessao);
  if (sessao !== sessaoChave) {
    setSessaoChave(sessao);
    setReferencia("");
    setImpressoEm(new Date());
  }

  const nome = cliente?.nome ?? "";
  const temCliente = cliente != null;
  const opts = useMemo<EtiquetaClienteOpts | null>(() => {
    if (!open || !temCliente) return null;
    return { nome, referencia, impressoEm };
  }, [open, temCliente, nome, referencia, impressoEm]);

  useEffect(() => {
    if (!opts) {
      setPreviewUrl(null);
      return;
    }
    try {
      setPreviewUrl(renderEtiquetaClienteDataUrl(opts));
    } catch {
      setPreviewUrl(null);
      toast.error("Não foi possível montar a etiqueta");
    }
  }, [opts]);

  /**
   * Envia o ZPL à Elgin. Se o QZ Tray não responder, imprime pelo navegador.
   */
  async function handlePrint() {
    if (!opts || printing) return;
    setPrinting(true);
    try {
      const zpl = gerarZplEtiquetaCliente(opts);
      const result = await imprimirZplViaQz(zpl);
      if (result.ok) {
        toast.success(`Enviado para ${result.printer}`);
        return;
      }
      toast.message(result.message);
      gerarEImprimirEtiquetaCliente(opts);
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
            Cliente ({ETIQUETA_CLIENTE_LARGURA_MM}×{ETIQUETA_CLIENTE_ALTURA_MM})
          </DialogTitle>
        </DialogHeader>

        {!cliente ? (
          <p className="text-sm text-muted-foreground">Cliente não selecionado.</p>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-lg border bg-neutral-100 p-2">
              <div
                className="relative mx-auto w-full overflow-hidden rounded bg-white"
                style={{
                  aspectRatio: `${ETIQUETA_CLIENTE_LARGURA_MM} / ${ETIQUETA_CLIENTE_ALTURA_MM}`,
                }}
              >
                {!previewUrl ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt={`Etiqueta de ${cliente.nome}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="etiqueta-cliente-referencia">Referência</Label>
              <Input
                id="etiqueta-cliente-referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ex.: roda dianteira"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Sai na etiqueta e não fica salvo no cadastro.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => void handlePrint()} disabled={!cliente || printing}>
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
