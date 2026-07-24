import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fmtBRL } from "@/lib/finance";
import { Plus, Trash2 } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";

export const FORMAS_PAGAMENTO_COMPRA = [
  "Dinheiro",
  "Pix",
  "Cartão",
  "Boleto",
  "Transferência",
] as const;

type ItemForm = { descricao: string; quantidade: string; valor: string };
type ParcelaForm = {
  numero: number;
  valor: string;
  data_vencimento: string;
  status: "aberta" | "paga";
  data_pagamento?: string | null;
  id?: string;
};

/**
 * Soma dias a uma data ISO (YYYY-MM-DD) sem alterar o fuso local.
 */
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Distribui valor total em N parcelas (centavos no último ajuste).
 */
function splitValor(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

/**
 * Dialog de criar/editar compra com itens e parcelas.
 */
export function CompraFormDialog({
  open,
  onOpenChange,
  compraId,
  defaultFornecedorId,
  fornecedorLocked,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compraId?: string | null;
  defaultFornecedorId?: string | null;
  fornecedorLocked?: boolean;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [fornecedorId, setFornecedorId] = useState("");
  const [dataCompra, setDataCompra] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("Boleto");
  const [numeroNf, setNumeroNf] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemForm[]>([
    { descricao: "", quantidade: "1", valor: "" },
  ]);
  const [parcelas, setParcelas] = useState<ParcelaForm[]>([]);
  const [nParcelas, setNParcelas] = useState("1");
  const [primeiroVenc, setPrimeiroVenc] = useState("");

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const valorTotal = useMemo(
    () =>
      itens.reduce((acc, it) => {
        const q = Number(it.quantidade) || 0;
        const v = Number(String(it.valor).replace(",", ".")) || 0;
        return acc + q * v;
      }, 0),
    [itens],
  );

  /**
   * Carrega compra existente ou reseta formulário novo.
   */
  useEffect(() => {
    if (!open) return;

    async function load() {
      if (compraId) {
        const { data: c, error } = await supabase
          .from("compras")
          .select("*")
          .eq("id", compraId)
          .single();
        if (error || !c) {
          toast.error(error?.message ?? "Compra não encontrada");
          return;
        }
        setFornecedorId(c.fornecedor_id);
        setDataCompra(c.data_compra);
        setFormaPagamento(c.forma_pagamento);
        setNumeroNf(c.numero_nf ?? "");
        setObservacoes(c.observacoes ?? "");

        const { data: its } = await supabase
          .from("compra_itens")
          .select("*")
          .eq("compra_id", compraId)
          .order("ordem");
        setItens(
          (its ?? []).length
            ? (its ?? []).map((i) => ({
                descricao: i.descricao,
                quantidade: String(i.quantidade),
                valor: String(i.valor),
              }))
            : [{ descricao: "", quantidade: "1", valor: "" }],
        );

        const { data: pars } = await supabase
          .from("compra_parcelas")
          .select("*")
          .eq("compra_id", compraId)
          .order("numero");
        const loaded = (pars ?? []).map((p) => ({
          id: p.id,
          numero: p.numero,
          valor: String(p.valor),
          data_vencimento: p.data_vencimento,
          status: (p.status === "paga" ? "paga" : "aberta") as "aberta" | "paga",
          data_pagamento: p.data_pagamento,
        }));
        setParcelas(loaded);
        setNParcelas(String(loaded.length || 1));
        setPrimeiroVenc(loaded[0]?.data_vencimento ?? c.data_compra);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        setFornecedorId(defaultFornecedorId ?? "");
        setDataCompra(today);
        setFormaPagamento("Boleto");
        setNumeroNf("");
        setObservacoes("");
        setItens([{ descricao: "", quantidade: "1", valor: "" }]);
        setParcelas([]);
        setNParcelas("1");
        setPrimeiroVenc(today);
      }
    }

    void load();
  }, [open, compraId, defaultFornecedorId]);

  /**
   * Gera N parcelas a partir da data inicial, somando o valor total.
   */
  function gerarParcelas() {
    const n = Math.max(1, Math.min(36, Number(nParcelas) || 1));
    const base = primeiroVenc || dataCompra;
    if (!base) return toast.error("Informe a data do 1º vencimento");
    if (valorTotal <= 0) return toast.error("Informe os itens com valor");
    const vals = splitValor(valorTotal, n);
    setParcelas(
      vals.map((valor, i) => ({
        numero: i + 1,
        valor: valor.toFixed(2),
        data_vencimento: addMonths(base, i),
        status: "aberta" as const,
        data_pagamento: null,
      })),
    );
    setNParcelas(String(n));
  }

  /**
   * Persiste compra, itens e parcelas (delete+reinsert em edição).
   */
  async function save() {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!fornecedorId) return toast.error("Selecione o fornecedor");
    if (!dataCompra) return toast.error("Informe a data da compra");
    if (!formaPagamento) return toast.error("Informe a forma de pagamento");

    const itensOk = itens.filter((i) => i.descricao.trim());
    if (!itensOk.length) return toast.error("Informe ao menos um item");
    if (valorTotal <= 0) return toast.error("Valor total deve ser maior que zero");
    if (!parcelas.length) return toast.error("Gere ou informe as parcelas");

    const somaParc = parcelas.reduce(
      (a, p) => a + (Number(String(p.valor).replace(",", ".")) || 0),
      0,
    );
    if (Math.abs(somaParc - valorTotal) > 0.02) {
      return toast.error(
        `Soma das parcelas (${fmtBRL(somaParc)}) difere do total (${fmtBRL(valorTotal)})`,
      );
    }
    for (const p of parcelas) {
      if (!p.data_vencimento) return toast.error("Todas as parcelas precisam de vencimento");
    }

    setBusy(true);

    const header = {
      fornecedor_id: fornecedorId,
      data_compra: dataCompra,
      forma_pagamento: formaPagamento,
      valor_total: valorTotal,
      numero_nf: numeroNf.trim() || null,
      observacoes: observacoes.trim() || null,
    };

    let id = compraId ?? null;

    if (id) {
      const { error } = await supabase.from("compras").update(header).eq("id", id);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      await supabase.from("compra_itens").delete().eq("compra_id", id);
      await supabase.from("compra_parcelas").delete().eq("compra_id", id);
    } else {
      const { data, error } = await supabase
        .from("compras")
        .insert({ ...header, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        return toast.error(error?.message ?? "Erro ao criar compra");
      }
      id = data.id;
    }

    const { error: eItens } = await supabase.from("compra_itens").insert(
      itensOk.map((it, ordem) => ({
        compra_id: id!,
        descricao: it.descricao.trim(),
        quantidade: Number(it.quantidade) || 1,
        valor: Number(String(it.valor).replace(",", ".")) || 0,
        ordem,
      })),
    );
    if (eItens) {
      setBusy(false);
      return toast.error(eItens.message);
    }

    const { error: eParc } = await supabase.from("compra_parcelas").insert(
      parcelas.map((p) => ({
        compra_id: id!,
        numero: p.numero,
        valor: Number(String(p.valor).replace(",", ".")) || 0,
        data_vencimento: p.data_vencimento,
        status: p.status,
        data_pagamento:
          p.status === "paga"
            ? p.data_pagamento || new Date().toISOString()
            : null,
      })),
    );

    setBusy(false);
    if (eParc) return toast.error(eParc.message);

    toast.success(compraId ? "Compra atualizada" : "Compra registrada");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{compraId ? "Editar compra" : "Nova compra"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Fornecedor *</Label>
            <Select
              value={fornecedorId}
              onValueChange={setFornecedorId}
              disabled={fornecedorLocked && !!defaultFornecedorId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                    {!f.ativo ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data da compra *</Label>
            <Input
              type="date"
              value={dataCompra}
              onChange={(e) => setDataCompra(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento *</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO_COMPRA.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nº NF</Label>
            <Input value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total</Label>
            <div className="flex h-9 items-center rounded-md border bg-secondary/40 px-3 text-sm font-semibold">
              {fmtBRL(valorTotal)}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Itens</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setItens((prev) => [
                  ...prev,
                  { descricao: "", quantidade: "1", valor: "" },
                ])
              }
            >
              <Plus className="size-3.5" /> Item
            </Button>
          </div>
          {itens.map((it, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_80px_140px_36px]">
              <Input
                placeholder="Descrição"
                value={it.descricao}
                onChange={(e) => {
                  const v = e.target.value;
                  setItens((prev) =>
                    prev.map((row, i) => (i === idx ? { ...row, descricao: v } : row)),
                  );
                }}
              />
              <Input
                inputMode="decimal"
                placeholder="Qtd"
                value={it.quantidade}
                onChange={(e) => {
                  const v = e.target.value;
                  setItens((prev) =>
                    prev.map((row, i) => (i === idx ? { ...row, quantidade: v } : row)),
                  );
                }}
              />
              <CurrencyInput
                value={it.valor}
                onChange={(v) => {
                  setItens((prev) =>
                    prev.map((row, i) => (i === idx ? { ...row, valor: v } : row)),
                  );
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={itens.length <= 1}
                onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <Label className="text-sm font-semibold">Parcelas / vencimentos</Label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5 w-24">
              <Label className="text-xs">Nº parcelas</Label>
              <Input
                inputMode="numeric"
                value={nParcelas}
                onChange={(e) => setNParcelas(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">1º vencimento</Label>
              <Input
                type="date"
                value={primeiroVenc}
                onChange={(e) => setPrimeiroVenc(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={gerarParcelas}>
              Gerar parcelas
            </Button>
          </div>

          {parcelas.length > 0 && (
            <div className="space-y-2 mt-2">
              {parcelas.map((p, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 sm:grid-cols-[48px_1fr_1fr_120px] items-center"
                >
                  <span className="text-xs text-muted-foreground">#{p.numero}</span>
                  <Input
                    type="date"
                    value={p.data_vencimento}
                    onChange={(e) => {
                      const v = e.target.value;
                      setParcelas((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, data_vencimento: v } : row,
                        ),
                      );
                    }}
                  />
                  <CurrencyInput
                    value={p.valor}
                    onChange={(v) => {
                      setParcelas((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, valor: v } : row)),
                      );
                    }}
                  />
                  <Select
                    value={p.status}
                    onValueChange={(v) =>
                      setParcelas((prev) =>
                        prev.map((row, i) =>
                          i === idx
                            ? {
                                ...row,
                                status: v as "aberta" | "paga",
                                data_pagamento:
                                  v === "paga"
                                    ? row.data_pagamento || new Date().toISOString()
                                    : null,
                              }
                            : row,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="paga">Paga</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
