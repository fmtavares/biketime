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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FORMAS_PAGAMENTO_DESPESA } from "@/lib/despesas";
import { CurrencyInput } from "@/components/CurrencyInput";
import { garantirLancamentoRecorrente } from "@/lib/despesas-gerar";

/**
 * Dialog de criar/editar modelo de despesa recorrente (ex.: Luz todo dia 10).
 */
export function DespesaRecorrenteFormDialog({
  open,
  onOpenChange,
  recorrente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recorrente?: any | null;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [valorEstimado, setValorEstimado] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [ativo, setAtivo] = useState(true);
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
    if (recorrente) {
      setDescricao(recorrente.descricao ?? "");
      setCategoriaId(recorrente.categoria_id ?? "");
      setDiaVencimento(String(recorrente.dia_vencimento ?? 10));
      setValorEstimado(
        recorrente.valor_estimado != null ? String(recorrente.valor_estimado) : "",
      );
      setFormaPagamento(recorrente.forma_pagamento ?? "");
      setAtivo(recorrente.ativo !== false);
      setObservacoes(recorrente.observacoes ?? "");
    } else {
      setDescricao("");
      setCategoriaId("");
      setDiaVencimento("10");
      setValorEstimado("");
      setFormaPagamento("Boleto");
      setAtivo(true);
      setObservacoes("");
    }
  }, [open, recorrente]);

  /**
   * Persiste o modelo recorrente.
   */
  async function save() {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    const dia = Number(diaVencimento);
    if (!dia || dia < 1 || dia > 28) {
      return toast.error("Dia do vencimento deve ser entre 1 e 28");
    }

    const payload = {
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      dia_vencimento: dia,
      valor_estimado: valorEstimado
        ? Number(String(valorEstimado).replace(",", ".")) || null
        : null,
      forma_pagamento: formaPagamento || null,
      ativo,
      observacoes: observacoes.trim() || null,
    };

    setBusy(true);
    const { data, error } = recorrente?.id
      ? await supabase
          .from("despesa_recorrentes")
          .update(payload)
          .eq("id", recorrente.id)
          .select(
            "id, descricao, categoria_id, dia_vencimento, valor_estimado, forma_pagamento, observacoes, ativo",
          )
          .single()
      : await supabase
          .from("despesa_recorrentes")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select(
            "id, descricao, categoria_id, dia_vencimento, valor_estimado, forma_pagamento, observacoes, ativo",
          )
          .single();

    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Erro ao salvar");
    }

    /** Já cria o lançamento previsto do mês corrente se estiver ativo. */
    if (data.ativo) {
      const now = new Date();
      const gerado = await garantirLancamentoRecorrente({
        recorrente: data,
        ano: now.getFullYear(),
        mes: now.getMonth() + 1,
        createdBy: user?.id ?? null,
      });
      if (gerado.error) {
        setBusy(false);
        return toast.error(gerado.error);
      }
    }

    setBusy(false);
    toast.success(recorrente?.id ? "Recorrente atualizado" : "Recorrente criado");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {recorrente?.id ? "Editar recorrente" : "Nova despesa recorrente"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Luz da loja"
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
                  <SelectValue />
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
              <Label className="text-xs">Dia do vencimento (1–28) *</Label>
              <Input
                inputMode="numeric"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor estimado (opcional)</Label>
              <CurrencyInput
                value={valorEstimado}
                onChange={setValorEstimado}
                placeholder="R$ 0,00 (referência)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de pagamento</Label>
              <Select
                value={formaPagamento || "__none__"}
                onValueChange={(v) => setFormaPagamento(v === "__none__" ? "" : v)}
              >
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={ativo} onCheckedChange={setAtivo} id="rec-ativo" />
            <Label htmlFor="rec-ativo">Ativo (gera lançamentos do mês)</Label>
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
