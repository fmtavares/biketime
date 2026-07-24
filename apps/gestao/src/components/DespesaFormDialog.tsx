import { useEffect, useState } from "react";
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
import { FORMAS_PAGAMENTO_DESPESA, competenciaMes } from "@/lib/despesas";
import { CurrencyInput } from "@/components/CurrencyInput";

/**
 * Dialog de criar/editar lançamento de despesa (avulsa ou prevista).
 */
export function DespesaFormDialog({
  open,
  onOpenChange,
  despesa,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  despesa?: any | null;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [dataVencimento, setDataVencimento] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [status, setStatus] = useState<"prevista" | "paga">("prevista");
  const [observacoes, setObservacoes] = useState("");

  const { data: categorias = [] } = useQuery({
    queryKey: ["despesa-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesa_categorias")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    if (despesa) {
      setDescricao(despesa.descricao ?? "");
      setCategoriaId(despesa.categoria_id ?? "");
      setDataVencimento(despesa.data_vencimento ?? "");
      setValor(despesa.valor != null ? String(despesa.valor) : "");
      setFormaPagamento(despesa.forma_pagamento ?? "");
      setStatus(despesa.status === "paga" ? "paga" : "prevista");
      setObservacoes(despesa.observacoes ?? "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDescricao("");
      setCategoriaId("");
      setDataVencimento(today);
      setValor("");
      setFormaPagamento("Pix");
      setStatus("prevista");
      setObservacoes("");
    }
  }, [open, despesa]);

  /**
   * Persiste o lançamento; ao marcar paga, grava data_pagamento.
   */
  async function save() {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (!dataVencimento) return toast.error("Informe o vencimento");
    const valorNum = Number(String(valor).replace(",", ".")) || 0;
    if (status === "paga" && valorNum <= 0) {
      return toast.error("Informe o valor pago");
    }

    const [y, m] = dataVencimento.split("-").map(Number);
    const payload = {
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      data_vencimento: dataVencimento,
      competencia: despesa?.competencia ?? competenciaMes(y, m),
      valor: valorNum,
      forma_pagamento: formaPagamento || null,
      status,
      data_pagamento:
        status === "paga"
          ? despesa?.data_pagamento || new Date().toISOString()
          : null,
      observacoes: observacoes.trim() || null,
      recorrente_id: despesa?.recorrente_id ?? null,
    };

    setBusy(true);
    const { error } = despesa?.id
      ? await supabase.from("despesas").update(payload).eq("id", despesa.id)
      : await supabase
          .from("despesas")
          .insert({ ...payload, created_by: user?.id ?? null });
    setBusy(false);

    if (error) return toast.error(error.message);
    toast.success(despesa?.id ? "Despesa atualizada" : "Despesa lançada");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {despesa?.id ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Conta de luz, parafusos…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={categoriaId || "__none__"}
                onValueChange={(v) => setCategoriaId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Vencimento *</Label>
              <Input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <CurrencyInput value={valor} onChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={formaPagamento || "__none__"} onValueChange={(v) => setFormaPagamento(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {FORMAS_PAGAMENTO_DESPESA.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as "prevista" | "paga")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prevista">Prevista</SelectItem>
                  <SelectItem value="paga">Paga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
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
