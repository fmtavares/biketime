import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  parseNfeCompraFile,
  soDigitos,
  type NfeCompraParseada,
} from "@/lib/nfe-compra-xml";
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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar XML da NFe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
            className="w-full"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy && !parsed ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {fileName || "Escolher arquivo XML"}
          </Button>

          {parsed && (
            <div className="space-y-3 rounded-lg border bg-secondary/30 p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="font-medium">{parsed.emitente.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCnpj(parsed.emitente.cnpj)}
                  {fornecedorExistente
                    ? ` · já cadastrado (${fornecedorExistente.nome})`
                    : " · será cadastrado"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">NF</p>
                  <p className="font-medium">{parsed.numeroNf}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emissão</p>
                  <p className="font-medium">{parsed.dataEmissao}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pagamento</p>
                  <p className="font-medium">{parsed.formaPagamento}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-medium">{fmtBRL(parsed.valorTotal)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Itens ({parsed.itens.length})
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {parsed.itens.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{it.descricao}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {it.quantidade} × {fmtBRL(it.valorUnitario)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Parcelas ({parsed.parcelas.length})
                </p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {parsed.parcelas.map((p) => (
                    <li key={p.numero}>
                      #{p.numero} · {p.dataVencimento} · {fmtBRL(p.valor)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void confirmar()}
            disabled={!parsed || busy || !isAdmin}
          >
            {busy && parsed ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Confirmar importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
