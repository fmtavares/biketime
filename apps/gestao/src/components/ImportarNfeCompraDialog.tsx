import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  parseNfeCompraFile,
  soDigitos,
  type NfeCompraParseada,
} from "@/lib/nfe-compra-xml";
import { fmtDataCurtaYY } from "@/lib/datas";
import { fmtBRL } from "@/lib/finance";
import { formatCnpj } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Chamado após salvar fornecedor + compra. */
  onSaved?: () => void;
};

/**
 * Importa XML de NFe: cadastra fornecedor (se novo) e registra a compra com itens.
 * Nesta etapa não cria/atualiza produtos nem estoque.
 */
export function ImportarNfeCompraDialog({ open, onOpenChange, onSaved }: Props) {
  const { user, isAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<NfeCompraParseada | null>(null);
  const [fornecedorExistente, setFornecedorExistente] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [fileName, setFileName] = useState("");

  /** Limpa estado ao fechar. */
  function reset() {
    setParsed(null);
    setFornecedorExistente(null);
    setFileName("");
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  /**
   * Lê o XML, faz parse e verifica se o CNPJ já existe em fornecedores.
   */
  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setParsed(null);
    setFornecedorExistente(null);
    setFileName(file.name);
    try {
      const data = await parseNfeCompraFile(file);
      const cnpj = soDigitos(data.emitente.cnpj);

      const { data: forn, error } = await supabase
        .from("fornecedores")
        .select("id, nome, cnpj")
        .eq("cnpj", cnpj)
        .maybeSingle();
      if (error) throw error;

      // Fallback: CNPJ pode ter sido salvo com máscara em dados antigos
      let matchId = forn?.id ?? null;
      let matchNome = forn?.nome ?? null;
      if (!matchId) {
        const { data: list } = await supabase
          .from("fornecedores")
          .select("id, nome, cnpj")
          .not("cnpj", "is", null);
        const found = (list ?? []).find(
          (f) => soDigitos(f.cnpj ?? "") === cnpj,
        );
        matchId = found?.id ?? null;
        matchNome = found?.nome ?? null;
      }

      setFornecedorExistente(
        matchId && matchNome ? { id: matchId, nome: matchNome } : null,
      );
      setParsed(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o XML");
      setFileName("");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Garante fornecedor (cria se CNPJ novo) e grava compra + itens + parcelas.
   */
  async function confirmar() {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!parsed) return;

    setBusy(true);
    try {
      const cnpj = soDigitos(parsed.emitente.cnpj);
      let fornecedorId = fornecedorExistente?.id ?? null;

      if (!fornecedorId) {
        let nome = parsed.emitente.nome.trim().slice(0, 200);
        // nome é UNIQUE — se conflitar, sufixa com CNPJ
        const { data: byName } = await supabase
          .from("fornecedores")
          .select("id")
          .eq("nome", nome)
          .maybeSingle();
        if (byName) nome = `${nome} (${cnpj})`.slice(0, 200);

        const { data: created, error: eForn } = await supabase
          .from("fornecedores")
          .insert({
            nome,
            nome_fantasia: parsed.emitente.nomeFantasia,
            cnpj,
            telefone: parsed.emitente.telefone,
            cidade: parsed.emitente.cidade,
            estado: parsed.emitente.estado,
            ativo: true,
            created_by: user?.id ?? null,
          })
          .select("id, nome")
          .single();
        if (eForn || !created) {
          throw new Error(eForn?.message ?? "Erro ao cadastrar fornecedor");
        }
        fornecedorId = created.id;
      }

      // Evita duplicar mesma NF do mesmo fornecedor
      const { data: dup } = await supabase
        .from("compras")
        .select("id")
        .eq("fornecedor_id", fornecedorId)
        .eq("numero_nf", parsed.numeroNf)
        .maybeSingle();
      if (dup) {
        throw new Error(
          `Já existe compra com NF ${parsed.numeroNf} para este fornecedor`,
        );
      }

      const obsParts = [
        parsed.chaveAcesso ? `NFe chave ${parsed.chaveAcesso}` : null,
        "Importado via XML",
      ].filter(Boolean);

      const { data: compra, error: eCompra } = await supabase
        .from("compras")
        .insert({
          fornecedor_id: fornecedorId,
          data_compra: parsed.dataEmissao,
          forma_pagamento: parsed.formaPagamento,
          valor_total: parsed.valorTotal,
          numero_nf: parsed.numeroNf,
          observacoes: obsParts.join(" · "),
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (eCompra || !compra) {
        throw new Error(eCompra?.message ?? "Erro ao cadastrar compra");
      }

      const { error: eItens } = await supabase.from("compra_itens").insert(
        parsed.itens.map((it, ordem) => ({
          compra_id: compra.id,
          descricao: it.descricao,
          quantidade: it.quantidade,
          valor: it.valorUnitario,
          ordem,
        })),
      );
      if (eItens) throw new Error(eItens.message);

      const { error: eParc } = await supabase.from("compra_parcelas").insert(
        parsed.parcelas.map((p) => ({
          compra_id: compra.id,
          numero: p.numero,
          valor: p.valor,
          data_vencimento: p.dataVencimento,
          status: "aberta" as const,
          data_pagamento: null,
        })),
      );
      if (eParc) throw new Error(eParc.message);

      toast.success(
        fornecedorExistente
          ? "Compra importada"
          : "Fornecedor cadastrado e compra importada",
      );
      reset();
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setBusy(false);
    }
  }

  const nomeExibicao =
    parsed?.emitente.nomeFantasia || parsed?.emitente.nome || "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden overflow-x-hidden p-0 sm:w-full">
        <DialogHeader className="shrink-0 space-y-1 border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Importar XML da NFe</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6">
          <input
            ref={inputRef}
            type="file"
            accept=".xml,text/xml,application/xml"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto w-full max-w-full min-w-0 justify-start gap-2 overflow-hidden px-3 py-2.5"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && !parsed ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <FileUp className="size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1 truncate text-left">
              {fileName || "Escolher arquivo XML"}
            </span>
          </Button>

          {parsed && (
            <div className="w-full max-w-full min-w-0 space-y-3 overflow-hidden rounded-lg border bg-secondary/30 p-3 text-sm">
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="truncate font-medium" title={nomeExibicao}>
                  {nomeExibicao}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatCnpj(parsed.emitente.cnpj)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fornecedorExistente
                    ? "Já cadastrado — será reutilizado"
                    : "Novo — será cadastrado"}
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-2 gap-x-2 gap-y-2">
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs text-muted-foreground">NF</p>
                  <p className="truncate font-medium">{parsed.numeroNf}</p>
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs text-muted-foreground">Emissão</p>
                  <p className="truncate font-medium">
                    {fmtDataCurtaYY(parsed.dataEmissao)}
                  </p>
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs text-muted-foreground">Pagamento</p>
                  <p className="truncate font-medium">{parsed.formaPagamento}</p>
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="truncate font-medium tabular-nums">
                    {fmtBRL(parsed.valorTotal)}
                  </p>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden">
                <p className="mb-1 text-xs text-muted-foreground">
                  Itens ({parsed.itens.length})
                </p>
                <ul className="max-h-36 w-full min-w-0 space-y-2 overflow-y-auto overflow-x-hidden rounded-md border bg-background/60 p-2 text-xs">
                  {parsed.itens.map((it, i) => (
                    <li
                      key={i}
                      className="grid w-full min-w-0 grid-cols-1 gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3"
                    >
                      <span className="min-w-0 break-all leading-snug">
                        {it.descricao}
                      </span>
                      <span className="tabular-nums text-muted-foreground sm:text-right">
                        {it.quantidade} × {fmtBRL(it.valorUnitario)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0 overflow-hidden">
                <p className="mb-1 text-xs text-muted-foreground">
                  Parcelas ({parsed.parcelas.length})
                </p>
                <ul className="max-h-28 w-full min-w-0 space-y-1 overflow-y-auto overflow-x-hidden rounded-md border bg-background/60 p-2 text-xs text-muted-foreground">
                  {parsed.parcelas.map((p) => (
                    <li
                      key={p.numero}
                      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                    >
                      <span className="truncate">
                        #{p.numero} · {fmtDataCurtaYY(p.dataVencimento)}
                      </span>
                      <span className="tabular-nums">{fmtBRL(p.valor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void confirmar()}
            disabled={!parsed || busy || !isAdmin}
          >
            {busy && parsed ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
