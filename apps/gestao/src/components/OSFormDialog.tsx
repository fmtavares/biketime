import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { ClienteCombobox } from "@/components/ClienteCombobox";
import { ServicoCombobox } from "@/components/ServicoCombobox";
import { CurrencyInput } from "@/components/CurrencyInput";
import { filtrarUsuariosEquipe } from "@/lib/usuarios-sistema";
import { useAuth } from "@/lib/auth-context";
import { fmtBRL } from "@/lib/finance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

type ModoAtendimento = "diagnostico" | "direto";

type ItemLinhaValor = {
  key: string;
  catalogoId?: string;
  nome: string;
  valor: number;
};

/**
 * Busca nome do usuário logado (profile) para preencher campos de equipe.
 */
async function nomeUsuarioLogado(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  let nome = auth.user?.email ?? "";
  if (auth.user?.id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", auth.user.id)
      .maybeSingle();
    nome = prof?.full_name ?? prof?.email ?? nome;
  }
  return nome;
}

export function OSFormDialog({
  open, onOpenChange, os, defaultClienteId, onSaved, onDeleted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  os?: any;
  defaultClienteId?: string;
  onSaved?: () => void;
  /** Chamado após excluir a OS em edição. */
  onDeleted?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [bikes, setBikes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [servicosCatalogo, setServicosCatalogo] = useState<
    { id: string; nome: string; valor: number }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>(initial());
  /** Só na criação: diagnóstico (fluxo completo) ou serviço direto (vai p/ execução). */
  const [modo, setModo] = useState<ModoAtendimento>("diagnostico");
  /** Serviço selecionado na lista (ainda não adicionado até clicar em +). */
  const [servicoCatalogoId, setServicoCatalogoId] = useState("");
  /** Itens de serviço (vários, total somado). */
  const [itensServico, setItensServico] = useState<ItemLinhaValor[]>([]);
  /** Peças manuais (nome + valor) na avaliação. */
  const [itensPecas, setItensPecas] = useState<ItemLinhaValor[]>([]);
  const [nomePeca, setNomePeca] = useState("");
  const [valorPeca, setValorPeca] = useState("");

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
      supabase
        .from("clientes")
        .select("id, nome, whatsapp, email")
        .order("nome")
        .then(({ data }) => setClientes(data ?? []));
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name")
        .then(({ data }) => setUsuarios(filtrarUsuariosEquipe(data ?? [])));
      supabase
        .from("servicos_precos")
        .select("id, nome, valor")
        .order("nome")
        .then(({ data }) => setServicosCatalogo((data as any[]) ?? []));
      setModo("diagnostico");
      setServicoCatalogoId("");
      setItensServico([]);
      setItensPecas([]);
      setNomePeca("");
      setValorPeca("");
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

  /**
   * Alterna modo de atendimento na criação da OS.
   */
  function escolherModo(m: ModoAtendimento) {
    setModo(m);
    setItensServico([]);
    setServicoCatalogoId("");
    setItensPecas([]);
    setNomePeca("");
    setValorPeca("");
    if (m === "diagnostico") {
      setForm((f: any) => ({ ...f, status: "fila" }));
    } else {
      setForm((f: any) => ({ ...f, status: "em_execucao" }));
    }
  }

  const totalServicos = useMemo(
    () => itensServico.reduce((acc, i) => acc + (Number(i.valor) || 0), 0),
    [itensServico],
  );

  const totalPecas = useMemo(
    () => itensPecas.reduce((acc, i) => acc + (Number(i.valor) || 0), 0),
    [itensPecas],
  );

  /** Soma serviços + peças (listas novas ou valores já gravados na OS). */
  const totalGeral = useMemo(() => {
    const servicos =
      itensServico.length > 0
        ? totalServicos
        : Number(String(form.valor_mao_obra ?? "").replace(",", ".")) || 0;
    const pecas =
      itensPecas.length > 0
        ? totalPecas
        : Number(String(form.valor_pecas ?? "").replace(",", ".")) || 0;
    return servicos + pecas;
  }, [
    itensServico.length,
    itensPecas.length,
    totalServicos,
    totalPecas,
    form.valor_mao_obra,
    form.valor_pecas,
  ]);

  /**
   * Inclui o serviço selecionado na OS (clique em +) e limpa a seleção para o próximo.
   */
  function adicionarServicoSelecionado() {
    if (!servicoCatalogoId) {
      return toast.error("Selecione um serviço na lista");
    }
    const s = servicosCatalogo.find((x) => x.id === servicoCatalogoId);
    if (!s) return;
    setItensServico((prev) => [
      ...prev,
      {
        key: `${s.id}-${Date.now()}-${prev.length}`,
        catalogoId: s.id,
        nome: s.nome,
        valor: Number(s.valor) || 0,
      },
    ]);
    setServicoCatalogoId("");
  }

  /**
   * Remove um item da lista de serviços.
   */
  function removerServico(key: string) {
    setItensServico((prev) => prev.filter((i) => i.key !== key));
  }

  /**
   * Atualiza o valor de um item já na lista de serviços.
   */
  function atualizarValorItem(key: string, valorStr: string) {
    const valor =
      valorStr === "" || valorStr == null
        ? 0
        : Number(String(valorStr).replace(",", "."));
    setItensServico((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, valor: Number.isNaN(valor) ? 0 : valor }
          : i,
      ),
    );
  }

  /**
   * Inclui peça digitada (nome + valor) na lista.
   */
  function adicionarPeca() {
    const nome = nomePeca.trim();
    const valor =
      valorPeca === "" || valorPeca == null
        ? NaN
        : Number(String(valorPeca).replace(",", "."));
    if (!nome) return toast.error("Informe o nome da peça");
    if (Number.isNaN(valor) || valor < 0) return toast.error("Informe o valor da peça");
    setItensPecas((prev) => [
      ...prev,
      { key: `peca-${Date.now()}-${prev.length}`, nome, valor },
    ]);
    setNomePeca("");
    setValorPeca("");
  }

  /**
   * Remove peça da lista.
   */
  function removerPeca(key: string) {
    setItensPecas((prev) => prev.filter((i) => i.key !== key));
  }

  /**
   * Atualiza valor de uma peça na lista.
   */
  function atualizarValorPeca(key: string, valorStr: string) {
    const valor =
      valorStr === "" || valorStr == null
        ? 0
        : Number(String(valorStr).replace(",", "."));
    setItensPecas((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, valor: Number.isNaN(valor) ? 0 : valor }
          : i,
      ),
    );
  }

  const isNovaDireto = !os && modo === "direto";
  /** Nova OS com diagnóstico: fica na fila de entrada (sem escolher status na abertura). */
  const isNovaDiagnostico = !os && modo === "diagnostico";

  const save = async () => {
    if (!form.cliente_id || !form.bike_id) return toast.error("Cliente e bike são obrigatórios");
    if (!form.data_prevista) return toast.error("Data prevista de entrega é obrigatória");

    if (isNovaDireto) {
      if (itensServico.length === 0) {
        return toast.error("Adicione pelo menos um serviço");
      }
    }

    if (form.status === "em_execucao" && !isNovaDireto && !form.aprovado_por) {
      return toast.error("Para iniciar a execução, informe quem aprovou (cliente ou mecânico)");
    }
    if (form.status === "pago" && (!form.pago_por || !form.forma_pagamento)) {
      return toast.error("Para marcar como Pago, informe quem recebeu e a forma de pagamento");
    }
    setBusy(true);

    let status = isNovaDiagnostico ? "fila" : form.status;
    let mecanico = form.mecanico || "";
    let responsavelAvaliacao = form.responsavel_avaliacao || "";
    let dataAvaliacao: string | null = form.data_avaliacao || null;
    let aprovado = form.aprovado;
    let aprovadoPor = form.aprovado_por || "";
    let dataAprovacao: string | null = form.data_aprovacao || null;
    let valorAprovado = form.valor_aprovado ? Number(form.valor_aprovado) : null;
    let problemaRelatado = form.problema_relatado || "";
    let servicosExecutados = form.servicos_executados || "";
    let valorMaoObra = form.valor_mao_obra
      ? Number(String(form.valor_mao_obra).replace(",", "."))
      : 0;

    /** Lista de preços (direto ou diagnóstico): grava descrição + total. */
    if (itensServico.length > 0) {
      servicosExecutados = itensServico
        .map((i) => `${i.nome} — ${fmtBRL(i.valor)}`)
        .join("\n");
      valorMaoObra = totalServicos;
    }

    let pecasUtilizadas = form.pecas_utilizadas || "";
    let valorPecas = form.valor_pecas
      ? Number(String(form.valor_pecas).replace(",", ".")) || 0
      : 0;
    if (itensPecas.length > 0) {
      pecasUtilizadas = itensPecas
        .map((i) => `${i.nome} — ${fmtBRL(i.valor)}`)
        .join("\n");
      valorPecas = totalPecas;
    }

    if (isNovaDireto) {
      const agora = new Date().toISOString();
      const nome = await nomeUsuarioLogado();
      status = "em_execucao";
      mecanico = nome;
      responsavelAvaliacao = nome;
      dataAvaliacao = agora;
      aprovado = true;
      aprovadoPor = nome;
      dataAprovacao = agora;
      valorAprovado = valorMaoObra;
    }

    const statusFinalizado = ["finalizada", "entregue", "pago"].includes(status);
    let responsavelExecucao = form.responsavel_execucao || "";
    let dataConclusao: string | null = form.data_conclusao || null;
    if (statusFinalizado && !dataConclusao) dataConclusao = new Date().toISOString();
    if (statusFinalizado && !responsavelExecucao) {
      responsavelExecucao = await nomeUsuarioLogado();
    }
    const statusEntregue = ["entregue", "pago"].includes(status);
    const dataEntrega = statusEntregue
      ? (form.data_entrega || new Date().toISOString())
      : null;
    const statusAprovado = ["em_execucao", "com_problemas", "finalizada", "entregue", "pago"].includes(status);
    if (statusAprovado && !dataAprovacao) {
      dataAprovacao = new Date().toISOString();
    }
    if (statusAprovado && aprovado == null) {
      aprovado = true;
    }

    const payload: any = {
      ...form,
      status,
      mecanico: mecanico || null,
      responsavel_avaliacao: responsavelAvaliacao || null,
      data_avaliacao: dataAvaliacao,
      aprovado,
      aprovado_por: aprovadoPor || null,
      data_aprovacao: dataAprovacao,
      problema_relatado: problemaRelatado || null,
      servicos_executados: servicosExecutados || null,
      pecas_utilizadas: pecasUtilizadas || null,
      data_prevista: form.data_prevista || null,
      proxima_revisao: form.proxima_revisao || null,
      data_pagamento: status === "pago" ? (form.data_pagamento || new Date().toISOString()) : (form.data_pagamento || null),
      data_conclusao: dataConclusao,
      data_entrega: dataEntrega,
      responsavel_execucao: responsavelExecucao || null,
      valor_pecas: valorPecas,
      valor_mao_obra: valorMaoObra,
      valor_aprovado: valorAprovado,
    };
    delete payload.id;
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
    toast.success(
      os
        ? "OS atualizada"
        : isNovaDireto
          ? "OS criada — já na execução"
          : "OS criada",
    );
    onSaved?.();
    onOpenChange(false);
  };

  /**
   * Exclui a OS em edição (somente admin).
   */
  async function excluir() {
    if (!isAdmin || !os?.id) return;
    const label = os.numero ? ` ${os.numero}` : "";
    if (!confirm(`Excluir a OS${label}?\nEsta ação não pode ser desfeita.`)) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("ordens_servico").delete().eq("id", os.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("OS excluída");
    onDeleted?.();
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {os ? `Editar ${os.numero}` : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        {!os && (
          <div className="space-y-2">
            <Label className="text-xs">Tipo de atendimento</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => escolherModo("diagnostico")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  modo === "diagnostico"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="text-sm font-semibold">Com diagnóstico</div>
              </button>
              <button
                type="button"
                onClick={() => escolherModo("direto")}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  modo === "direto"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="text-sm font-semibold">Serviço direto</div>
              </button>
            </div>
          </div>
        )}

        <Tabs defaultValue="entrada">
          <TabsList>
            <TabsTrigger value="entrada">Entrada</TabsTrigger>
            {!isNovaDireto && (
              <TabsTrigger value="avaliacao">Avaliação</TabsTrigger>
            )}
            <TabsTrigger value="execucao">Execução</TabsTrigger>
            <TabsTrigger value="finalizacao">Entrega</TabsTrigger>
          </TabsList>

          <TabsContent value="entrada" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cliente *">
                <ClienteCombobox
                  clientes={clientes}
                  value={form.cliente_id}
                  onChange={(id) =>
                    setForm((f: any) => ({
                      ...f,
                      cliente_id: id,
                      bike_id: id === f.cliente_id ? f.bike_id : "",
                    }))
                  }
                  placeholder="Buscar cliente…"
                />
              </Field>
              <Field label="Bike *">
                <Select value={form.bike_id} onValueChange={(v) => set("bike_id", v)} disabled={!form.cliente_id}>
                  <SelectTrigger><SelectValue placeholder={form.cliente_id ? "Selecione" : "Escolha o cliente"} /></SelectTrigger>
                  <SelectContent>{bikes.map((b) => <SelectItem key={b.id} value={b.id}>{b.marca} {b.modelo}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {!isNovaDireto && (
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
              )}
              <Field label="Data prevista de entrega *">
                <Input
                  type="date"
                  required
                  value={form.data_prevista}
                  onChange={(e) => set("data_prevista", e.target.value)}
                />
              </Field>
              {/* Status só na edição; na abertura com diagnóstico a OS fica na fila de entrada. */}
              {os && (
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            {isNovaDireto ? (
              <div className="space-y-4 rounded-xl border p-4">
                <ListaServicosEditor
                  servicosCatalogo={servicosCatalogo}
                  servicoCatalogoId={servicoCatalogoId}
                  onServicoCatalogoIdChange={setServicoCatalogoId}
                  onAdicionar={adicionarServicoSelecionado}
                  itens={itensServico}
                  total={totalServicos}
                  onAtualizarValor={atualizarValorItem}
                  onRemover={removerServico}
                />
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total
                  </span>
                  <span className="font-display text-lg font-bold">
                    {fmtBRL(totalGeral)}
                  </span>
                </div>

                <Field label="Observação">
                  <Textarea
                    value={form.problema_relatado}
                    onChange={(e) => set("problema_relatado", e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Problema relatado">
                  <Textarea
                    value={form.problema_relatado}
                    onChange={(e) => set("problema_relatado", e.target.value)}
                  />
                </Field>
                <Field label="Checklist visual de entrada">
                  <Textarea
                    value={form.checklist_entrada}
                    onChange={(e) => set("checklist_entrada", e.target.value)}
                    placeholder="Riscos, faltas, estado dos componentes…"
                  />
                </Field>
              </>
            )}
          </TabsContent>

          {!isNovaDireto && (
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

              <div className="space-y-4 rounded-xl border p-4">
                <ListaServicosEditor
                  servicosCatalogo={servicosCatalogo}
                  servicoCatalogoId={servicoCatalogoId}
                  onServicoCatalogoIdChange={setServicoCatalogoId}
                  onAdicionar={adicionarServicoSelecionado}
                  itens={itensServico}
                  total={totalServicos}
                  onAtualizarValor={atualizarValorItem}
                  onRemover={removerServico}
                />
                {os && form.servicos_executados && itensServico.length === 0 && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    Atual: {form.servicos_executados}
                    {form.valor_mao_obra != null && form.valor_mao_obra !== ""
                      ? ` · ${fmtBRL(Number(form.valor_mao_obra) || 0)}`
                      : ""}
                  </p>
                )}
              </div>

              <div className="space-y-4 rounded-xl border p-4">
                <ListaPecasEditor
                  nome={nomePeca}
                  valor={valorPeca}
                  onNomeChange={setNomePeca}
                  onValorChange={setValorPeca}
                  onAdicionar={adicionarPeca}
                  itens={itensPecas}
                  total={totalPecas}
                  onAtualizarValor={atualizarValorPeca}
                  onRemover={removerPeca}
                />
                {os && form.pecas_utilizadas && itensPecas.length === 0 && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    Atual: {form.pecas_utilizadas}
                    {form.valor_pecas != null && form.valor_pecas !== ""
                      ? ` · ${fmtBRL(Number(form.valor_pecas) || 0)}`
                      : ""}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border bg-secondary/30 px-4 py-3">
                <span className="text-sm font-medium text-muted-foreground">
                  Total (serviços + peças)
                </span>
                <span className="font-display text-xl font-bold">
                  {fmtBRL(totalGeral)}
                </span>
              </div>

              <Field label="Observações Técnicas">
                <Textarea
                  value={form.observacoes_tecnicas}
                  onChange={(e) => set("observacoes_tecnicas", e.target.value)}
                />
              </Field>
            </TabsContent>
          )}

          <TabsContent value="execucao" className="space-y-4 mt-4">
            {!isNovaDireto && (
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
            )}
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

        <DialogFooter className="gap-2 sm:justify-between">
          {os?.id && isAdmin ? (
            <Button
              type="button"
              variant="destructive"
              onClick={excluir}
              disabled={busy}
            >
              Excluir OS
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

/**
 * Lista de serviços do catálogo de preços: buscar, +, itens e total.
 */
function ListaServicosEditor({
  servicosCatalogo,
  servicoCatalogoId,
  onServicoCatalogoIdChange,
  onAdicionar,
  itens,
  total,
  onAtualizarValor,
  onRemover,
}: {
  servicosCatalogo: { id: string; nome: string; valor: number }[];
  servicoCatalogoId: string;
  onServicoCatalogoIdChange: (id: string) => void;
  onAdicionar: () => void;
  itens: ItemLinhaValor[];
  total: number;
  onAtualizarValor: (key: string, v: string) => void;
  onRemover: (key: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Lista Serviço">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <ServicoCombobox
              servicos={servicosCatalogo}
              value={servicoCatalogoId}
              onChange={onServicoCatalogoIdChange}
              placeholder="Buscar serviço…"
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            title="Adicionar serviço"
            disabled={!servicoCatalogoId}
            onClick={onAdicionar}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </Field>

      {itens.length > 0 && (
        <div className="space-y-2">
          {itens.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {item.nome}
              </span>
              <CurrencyInput
                className="h-8 w-32"
                value={item.valor}
                onChange={(v) => onAtualizarValor(item.key, v)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onRemover(item.key)}
                title="Remover"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Total serviço</span>
            <span className="font-display text-base font-bold">
              {fmtBRL(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Lista de peças manuais: nome + valor + +, itens e total.
 */
function ListaPecasEditor({
  nome,
  valor,
  onNomeChange,
  onValorChange,
  onAdicionar,
  itens,
  total,
  onAtualizarValor,
  onRemover,
}: {
  nome: string;
  valor: string;
  onNomeChange: (v: string) => void;
  onValorChange: (v: string) => void;
  onAdicionar: () => void;
  itens: ItemLinhaValor[];
  total: number;
  onAtualizarValor: (key: string, v: string) => void;
  onRemover: (key: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Peças">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Input
              value={nome}
              onChange={(e) => onNomeChange(e.target.value)}
              placeholder="Nome da peça"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAdicionar();
                }
              }}
            />
          </div>
          <div className="w-full sm:w-36">
            <CurrencyInput
              value={valor}
              onChange={onValorChange}
              placeholder="Valor"
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="size-9 shrink-0"
            title="Adicionar peça"
            onClick={onAdicionar}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </Field>

      {itens.length > 0 && (
        <div className="space-y-2">
          {itens.map((item) => (
            <div
              key={item.key}
              className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {item.nome}
              </span>
              <CurrencyInput
                className="h-8 w-32"
                value={item.valor}
                onChange={(v) => onAtualizarValor(item.key, v)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onRemover(item.key)}
                title="Remover"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Total peças</span>
            <span className="font-display text-base font-bold">
              {fmtBRL(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
