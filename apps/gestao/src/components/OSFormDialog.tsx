import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const STATUS = [
  ["fila", "Fila"],
  ["avaliacao", "Avaliação"],
  ["aguardando_aprovacao", "Aguardando aprovação"],
  ["em_execucao", "Em execução"],
  ["com_problemas", "Com problemas"],
  ["finalizada", "Finalizada"],
  ["entregue", "Entregue"],
  ["pago", "Pago"],
];

export const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão"];

export function OSFormDialog({
  open, onOpenChange, os, defaultClienteId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; os?: any; defaultClienteId?: string; onSaved?: () => void }) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [bikes, setBikes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>(initial());

  function initial() {
    return {
      cliente_id: "", bike_id: "",
      problema_relatado: "", checklist_entrada: "", mecanico: "",
      data_prevista: "", servicos_executados: "", pecas_utilizadas: "",
      valor_pecas: "", valor_mao_obra: "", observacoes_tecnicas: "",
      aprovado: null, aprovado_por: "", valor_aprovado: "", observacao_conclusao: "",
      responsavel_avaliacao: "", data_avaliacao: null,
      data_aprovacao: null, observacoes_execucao: "",
      quem_puxou: "", responsavel_execucao: "",
      proxima_revisao: "", status: "fila",
      pago_por: "", forma_pagamento: "", data_pagamento: null,
      responsavel_entrega: "", responsavel_recebimento: "",
    };
  }

  useEffect(() => {
    if (open) {
      supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data ?? []));
      supabase.from("profiles").select("id, full_name, email").neq("email", "contato@biketime.com.br").order("full_name").then(({ data }) => setUsuarios(data ?? []));
      (supabase.from as any)("funcionarios").select("id, nome").order("nome").then(({ data }: any) => setFuncionarios(data ?? []));
      if (os) {
        setForm({
          ...os,
          data_prevista: os.data_prevista ?? "",
          proxima_revisao: os.proxima_revisao ?? "",
          valor_pecas: os.valor_pecas ?? "",
          valor_mao_obra: os.valor_mao_obra ?? "",
          valor_aprovado: os.valor_aprovado ?? "",
        });
      } else {
        setForm({ ...initial(), cliente_id: defaultClienteId ?? "" });
      }
    }
  }, [open, os, defaultClienteId]);

  useEffect(() => {
    if (form.cliente_id) {
      supabase.from("bikes").select("id, marca, modelo").eq("cliente_id", form.cliente_id).then(({ data }) => setBikes(data ?? []));
    } else {
      setBikes([]);
    }
  }, [form.cliente_id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.cliente_id || !form.bike_id) return toast.error("Cliente e bike são obrigatórios");
    if (form.status === "em_execucao" && !form.aprovado_por) {
      return toast.error("Para iniciar a execução, informe quem aprovou (cliente ou mecânico)");
    }
    if (form.status === "pago" && (!form.pago_por || !form.forma_pagamento)) {
      return toast.error("Para marcar como Pago, informe quem recebeu e a forma de pagamento");
    }
    setBusy(true);
    const statusFinalizado = ["finalizada", "entregue", "pago"].includes(form.status);
    let responsavelExecucao = form.responsavel_execucao || "";
    let dataConclusao: string | null = form.data_conclusao || null;
    if (statusFinalizado && !dataConclusao) dataConclusao = new Date().toISOString();
    if (statusFinalizado && !responsavelExecucao) {
      const { data: auth } = await supabase.auth.getUser();
      let nome = auth.user?.email ?? "";
      if (auth.user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle();
        nome = prof?.full_name ?? prof?.email ?? nome;
      }
      responsavelExecucao = nome;
    }
    const statusEntregue = ["entregue", "pago"].includes(form.status);
    const dataEntrega = statusEntregue
      ? (form.data_entrega || new Date().toISOString())
      : null;
    const statusAprovado = ["em_execucao", "com_problemas", "finalizada", "entregue", "pago"].includes(form.status);
    const dataAprovacao = statusAprovado
      ? (form.data_aprovacao || new Date().toISOString())
      : (form.data_aprovacao || null);
    const payload: any = {
      ...form,
      data_prevista: form.data_prevista || null,
      proxima_revisao: form.proxima_revisao || null,
      data_pagamento: form.status === "pago" ? (form.data_pagamento || new Date().toISOString()) : (form.data_pagamento || null),
      data_conclusao: dataConclusao,
      data_entrega: dataEntrega,
      data_aprovacao: dataAprovacao,
      responsavel_execucao: responsavelExecucao || null,
      valor_pecas: form.valor_pecas ? Number(form.valor_pecas) : 0,
      valor_mao_obra: form.valor_mao_obra ? Number(form.valor_mao_obra) : 0,
      valor_aprovado: form.valor_aprovado ? Number(form.valor_aprovado) : null,
    };
    delete payload.numero;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.clientes;
    delete payload.bikes;
    const { error } = os
      ? await supabase.from("ordens_servico").update(payload).eq("id", os.id)
      : await supabase.from("ordens_servico").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(os ? "OS atualizada" : "OS criada");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {os ? `Editar ${os.numero}` : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="entrada">
          <TabsList>
            <TabsTrigger value="entrada">Entrada</TabsTrigger>
            <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
            <TabsTrigger value="execucao">Execução</TabsTrigger>
            <TabsTrigger value="finalizacao">Entrega</TabsTrigger>
          </TabsList>

          <TabsContent value="entrada" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente *">
                <Select value={form.cliente_id} onValueChange={(v) => set("cliente_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Bike *">
                <Select value={form.bike_id} onValueChange={(v) => set("bike_id", v)} disabled={!form.cliente_id}>
                  <SelectTrigger><SelectValue placeholder={form.cliente_id ? "Selecione" : "Escolha o cliente"} /></SelectTrigger>
                  <SelectContent>{bikes.map((b) => <SelectItem key={b.id} value={b.id}>{b.marca} {b.modelo}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Responsável entrada">
                {os && form.mecanico ? (
                  <Input type="text" readOnly disabled value={form.mecanico} />
                ) : (
                  <Select value={form.mecanico || ""} onValueChange={(v) => set("mecanico", v)}>
                    <SelectTrigger><SelectValue placeholder="Quem deu entrada na bike?" /></SelectTrigger>
                    <SelectContent>{usuarios.map((u: any) => <SelectItem key={u.id} value={u.full_name ?? u.email}>{u.full_name ?? u.email}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="Data prevista de entrega"><Input type="date" value={form.data_prevista} onChange={(e) => set("data_prevista", e.target.value)} /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Problema relatado"><Textarea value={form.problema_relatado} onChange={(e) => set("problema_relatado", e.target.value)} /></Field>
            <Field label="Checklist visual de entrada"><Textarea value={form.checklist_entrada} onChange={(e) => set("checklist_entrada", e.target.value)} placeholder="Riscos, faltas, estado dos componentes…" /></Field>
          </TabsContent>

          <TabsContent value="avaliacao" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Responsável Avaliação">
                <Input type="text" readOnly disabled value={form.responsavel_avaliacao || "—"} />
              </Field>
              <Field label="Data Avaliação">
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={form.data_avaliacao ? new Date(form.data_avaliacao).toLocaleString("pt-BR") : "—"}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Preenchido automaticamente quando a OS é movida para Avaliação.</p>
            <Field label="Descrição Serviços"><Textarea value={form.servicos_executados} onChange={(e) => set("servicos_executados", e.target.value)} /></Field>
            <Field label="Descrição Peças"><Textarea value={form.pecas_utilizadas} onChange={(e) => set("pecas_utilizadas", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Valor Serviço (R$)"><Input type="number" step="0.01" value={form.valor_mao_obra} onChange={(e) => set("valor_mao_obra", e.target.value)} /></Field>
              <Field label="Valor Peças (R$)"><Input type="number" step="0.01" value={form.valor_pecas} onChange={(e) => set("valor_pecas", e.target.value)} /></Field>
            </div>
            <Field label="Observações Técnicas"><Textarea value={form.observacoes_tecnicas} onChange={(e) => set("observacoes_tecnicas", e.target.value)} /></Field>
          </TabsContent>

          <TabsContent value="execucao" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Responsável aprovação *">
                {os && form.aprovado_por ? (
                  <Input type="text" readOnly disabled value={form.aprovado_por} />
                ) : (
                  <Select value={form.aprovado_por || ""} onValueChange={(v) => set("aprovado_por", v)}>
                    <SelectTrigger><SelectValue placeholder="Quem aprovou a execução?" /></SelectTrigger>
                    <SelectContent>
                      {usuarios.map((u: any) => { const n = u.full_name ?? u.email; return <SelectItem key={u.id} value={n}>{n}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="Data aprovação">
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={form.data_aprovacao ? new Date(form.data_aprovacao).toLocaleString("pt-BR") : "—"}
                />
              </Field>
            </div>
            <Field label="Quem puxou?">
              <Select value={form.quem_puxou || ""} onValueChange={(v) => set("quem_puxou", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                <SelectContent>{usuarios.map((u: any) => { const n = u.full_name ?? u.email; return <SelectItem key={u.id} value={n}>{n}</SelectItem>; })}</SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Responsável execução">
                <Input type="text" readOnly disabled value={form.responsavel_execucao || "—"} />
              </Field>
              <Field label="Data de conclusão">
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={form.data_conclusao ? new Date(form.data_conclusao).toLocaleString("pt-BR") : "—"}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">Responsável execução e data de conclusão são preenchidos automaticamente quando a OS é movida para Finalizada.</p>
            <Field label="Observações da Execução">
              <Textarea value={form.observacoes_execucao || ""} onChange={(e) => set("observacoes_execucao", e.target.value)} />
            </Field>
          </TabsContent>

          <TabsContent value="finalizacao" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Responsável entrega">
                {os?.responsavel_entrega ? (
                  <Input type="text" readOnly disabled value={form.responsavel_entrega} />
                ) : (
                  <Select value={form.responsavel_entrega || ""} onValueChange={(v) => set("responsavel_entrega", v)}>
                    <SelectTrigger><SelectValue placeholder="Quem entregou a bike?" /></SelectTrigger>
                    <SelectContent>{usuarios.map((u: any) => { const n = u.full_name ?? u.email; return <SelectItem key={u.id} value={n}>{n}</SelectItem>; })}</SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="Data de entrega">
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={form.data_entrega ? new Date(form.data_entrega).toLocaleString("pt-BR") : "—"}
                />
              </Field>
            </div>
            <Field label="Observação de conclusão"><Textarea value={form.observacao_conclusao} onChange={(e) => set("observacao_conclusao", e.target.value)} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Próxima revisão recomendada"><Input type="date" value={form.proxima_revisao} onChange={(e) => set("proxima_revisao", e.target.value)} /></Field>
            </div>

            <div className="rounded-lg border p-3 space-y-3 bg-secondary/20">
              <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Pagamento</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={`Recebido por${form.status === "pago" ? " *" : ""}`}>
                  {os?.pago_por ? (
                    <Input type="text" readOnly disabled value={form.pago_por} />
                  ) : (
                    <Select value={form.pago_por || ""} onValueChange={(v) => set("pago_por", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o usuário" /></SelectTrigger>
                      <SelectContent>{usuarios.map((u: any) => { const n = u.full_name ?? u.email; return <SelectItem key={u.id} value={n}>{n}</SelectItem>; })}</SelectContent>
                    </Select>
                  )}
                </Field>
                <Field label={`Forma de pagamento${form.status === "pago" ? " *" : ""}`}>
                  <Select value={form.forma_pagamento || ""} onValueChange={(v) => set("forma_pagamento", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{FORMAS_PAGAMENTO.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
