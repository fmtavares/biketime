import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Flag } from "lucide-react";
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
import { dataMaisMeses } from "@/lib/datas";
import { fmtBRL } from "@/lib/finance";
import {
  appendObsAprovacao,
  parseHistoricoObsAprovacao,
} from "@/lib/observacoes-aprovacao";
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
 * Converte string monetária BR (ex.: "R$ 1.500,00") em número.
 */
function parseValorBRL(raw: string): number {
  const t = raw.replace(/\u00a0/g, " ").replace(/R\$\s*/i, "").trim();
  if (!t) return 0;
  if (t.includes(",")) {
    return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(t) || 0;
}

/**
 * Converte texto gravado (linhas "Nome — R$ X,XX") em itens editáveis.
 */
function parseLinhasValor(
  texto: string | null | undefined,
  keyPrefix: string,
): ItemLinhaValor[] {
  if (!texto?.trim()) return [];
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const m = line.match(/^(.+?)\s*[—–\-]\s*(.+)$/);
      if (m) {
        return {
          key: `${keyPrefix}-parsed-${idx}`,
          nome: m[1].trim(),
          valor: parseValorBRL(m[2]),
        };
      }
      return {
        key: `${keyPrefix}-parsed-${idx}`,
        nome: line,
        valor: 0,
      };
    });
}

/**
 * Associa itens ao catálogo de serviços pelo nome (quando houver match).
 */
function enriquecerServicosComCatalogo(
  itens: ItemLinhaValor[],
  catalogo: { id: string; nome: string; valor: number }[],
): ItemLinhaValor[] {
  if (catalogo.length === 0) return itens;
  return itens.map((i) => {
    if (i.catalogoId) return i;
    const match = catalogo.find(
      (c) => c.nome.trim().toLowerCase() === i.nome.trim().toLowerCase(),
    );
    return match ? { ...i, catalogoId: match.id } : i;
  });
}

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
  /** Nova nota da equipe anexada ao histórico de aprovação no save. */
  const [novaObsEquipe, setNovaObsEquipe] = useState("");

  function initial() {
    return {
      cliente_id: "", bike_id: "",
      problema_relatado: "", checklist_entrada: "", mecanico: "",
      data_prevista: "", servicos_executados: "", pecas_utilizadas: "",
      valor_pecas: "", valor_mao_obra: "", observacoes_tecnicas: "",
      aprovado: null, aprovado_por: "", valor_aprovado: "", observacao_conclusao: "",
      observacoes_aprovacao: "", observacao_aprovacao_origem: "",
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
      setNomePeca("");
      setValorPeca("");
      setNovaObsEquipe("");
      if (os) {
        setForm({
          ...os,
          data_prevista: os.data_prevista ?? "",
          proxima_revisao: os.proxima_revisao ?? "",
          valor_pecas: os.valor_pecas ?? "",
          valor_mao_obra: os.valor_mao_obra ?? "",
          valor_aprovado: os.valor_aprovado ?? "",
        });
        /** Hidrata listas editáveis a partir do texto já gravado na OS. */
        setItensServico(parseLinhasValor(os.servicos_executados, "svc"));
        setItensPecas(parseLinhasValor(os.pecas_utilizadas, "peca"));
        /** OS antiga sem responsável: sugere o usuário logado para preencher. */
        if (!os.mecanico) {
          void preencherMecanicoComUsuarioLogado();
        }
      } else {
        setForm({ ...initial(), cliente_id: defaultClienteId ?? "" });
        setItensServico([]);
        setItensPecas([]);
        /** Nova OS: responsável pela entrada começa como o usuário logado. */
        void preencherMecanicoComUsuarioLogado();
      }
    }
  }, [open, os, defaultClienteId]);

  /**
   * Preenche `mecanico` com o nome do usuário logado quando o campo ainda está vazio.
   */
  async function preencherMecanicoComUsuarioLogado() {
    const nome = await nomeUsuarioLogado();
    if (!nome) return;
    setForm((f: any) => (f.mecanico ? f : { ...f, mecanico: nome }));
  }

  /**
   * Quando o catálogo carrega, associa serviços hidratados aos IDs do catálogo.
   */
  useEffect(() => {
    if (!open || !os || servicosCatalogo.length === 0) return;
    setItensServico((prev) => enriquecerServicosComCatalogo(prev, servicosCatalogo));
  }, [open, os?.id, servicosCatalogo]);

  useEffect(() => {
    if (form.cliente_id) {
      supabase.from("bikes").select("id, marca, modelo").eq("cliente_id", form.cliente_id).then(({ data }) => setBikes(data ?? []));
    } else {
      setBikes([]);
    }
  }, [form.cliente_id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  /**
   * Atualiza o status; ao marcar como Pago, preenche próxima revisão com +3 meses se vazia.
   */
  function setStatus(v: string) {
    setForm((f: any) => ({
      ...f,
      status: v,
      proxima_revisao:
        v === "pago" && !f.proxima_revisao ? dataMaisMeses(3) : f.proxima_revisao,
    }));
  }

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
   * Atualiza o nome de um serviço já na lista.
   */
  function atualizarNomeServico(key: string, nome: string) {
    setItensServico((prev) =>
      prev.map((i) => (i.key === key ? { ...i, nome } : i)),
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

  /**
   * Atualiza o nome de uma peça já na lista.
   */
  function atualizarNomePeca(key: string, nome: string) {
    setItensPecas((prev) =>
      prev.map((i) => (i.key === key ? { ...i, nome } : i)),
    );
  }

  const isNovaDireto = !os && modo === "direto";
  /** Nova OS com diagnóstico: fica na fila de entrada (sem escolher status na abertura). */
  const isNovaDiagnostico = !os && modo === "diagnostico";

  /**
   * Salva a OS: valida campos obrigatórios e garante responsável pela entrada
   * (selecionado ou, se vazio, o usuário logado).
   */
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
    // Em Pago, próxima revisão é obrigatória (padrão +3 meses se ainda vazia)
    let proximaRevisao = form.proxima_revisao || "";
    if (form.status === "pago") {
      if (!proximaRevisao) proximaRevisao = dataMaisMeses(3);
      if (!proximaRevisao) {
        return toast.error("Para marcar como Pago, informe a próxima revisão recomendada");
      }
    }
    setBusy(true);

    let status = isNovaDiagnostico ? "fila" : form.status;
    let mecanico = String(form.mecanico || "").trim();
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

    /**
     * Na edição (ou com lista preenchida), persiste a lista atual —
     * inclusive vazia, para permitir remover todos os itens.
     */
    if (os || itensServico.length > 0) {
      servicosExecutados = itensServico
        .map((i) => `${i.nome} — ${fmtBRL(i.valor)}`)
        .join("\n");
      valorMaoObra = totalServicos;
    }

    let pecasUtilizadas = form.pecas_utilizadas || "";
    let valorPecas = form.valor_pecas
      ? Number(String(form.valor_pecas).replace(",", ".")) || 0
      : 0;
    if (os || itensPecas.length > 0) {
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

    /** Responsável pela entrada é obrigatório; se vazio, usa quem está logado. */
    if (!mecanico) {
      mecanico = (await nomeUsuarioLogado()).trim();
    }
    if (!mecanico) {
      setBusy(false);
      return toast.error("Informe o responsável pela entrada da bike");
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

    let observacoesAprovacao = String(form.observacoes_aprovacao ?? "").trim();
    let observacaoAprovacaoOrigem =
      observacoesAprovacao
        ? form.observacao_aprovacao_origem || "equipe"
        : "";
    const notaEquipe = novaObsEquipe.trim();
    if (notaEquipe) {
      observacoesAprovacao = appendObsAprovacao(
        observacoesAprovacao,
        "Equipe",
        notaEquipe,
      );
      observacaoAprovacaoOrigem = "equipe";
    }

    const payload: any = {
      ...form,
      status,
      mecanico,
      responsavel_avaliacao: responsavelAvaliacao || null,
      data_avaliacao: dataAvaliacao,
      aprovado,
      aprovado_por: aprovadoPor || null,
      data_aprovacao: dataAprovacao,
      problema_relatado: problemaRelatado || null,
      servicos_executados: servicosExecutados || null,
      pecas_utilizadas: pecasUtilizadas || null,
      data_prevista: form.data_prevista || null,
      proxima_revisao: proximaRevisao || form.proxima_revisao || null,
      data_pagamento: status === "pago" ? (form.data_pagamento || new Date().toISOString()) : (form.data_pagamento || null),
      data_conclusao: dataConclusao,
      data_entrega: dataEntrega,
      responsavel_execucao: responsavelExecucao || null,
      valor_pecas: valorPecas,
      valor_mao_obra: valorMaoObra,
      valor_aprovado: valorAprovado,
      observacoes_aprovacao: observacoesAprovacao || null,
      observacao_aprovacao_origem: observacoesAprovacao
        ? observacaoAprovacaoOrigem || "equipe"
        : null,
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
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-4 overflow-hidden p-4 sm:w-full sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {os ? `Editar ${os.numero}` : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
        {!os && (
          <div className="min-w-0 space-y-2">
            <Label className="text-xs">Tipo de atendimento</Label>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
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

        <Tabs defaultValue="entrada" className="min-w-0">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-0 w-full overflow-x-auto pb-0.5 sm:w-auto sm:flex-1">
              <TabsList className="inline-flex h-auto w-max max-w-none flex-nowrap">
                <TabsTrigger value="entrada" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                  Entrada
                </TabsTrigger>
                {!isNovaDireto && (
                  <TabsTrigger value="avaliacao" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                    Avaliação
                  </TabsTrigger>
                )}
                {!isNovaDireto && (
                  <TabsTrigger value="aprovacao" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                    Aprovação
                  </TabsTrigger>
                )}
                <TabsTrigger value="execucao" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                  Execução
                </TabsTrigger>
                <TabsTrigger value="finalizacao" className="px-2.5 text-xs sm:px-3 sm:text-sm">
                  Entrega
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Flag de aprovação: no mobile abaixo das abas; no desktop à direita. */}
            {!isNovaDireto && (
              <div className="shrink-0 self-end sm:ml-auto sm:self-center">
                {form.aprovado === true ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    <Flag className="size-3" />
                    Aprovado
                  </span>
                ) : form.aprovado === false ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                    <Flag className="size-3" />
                    Não aprovado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Flag className="size-3" />
                    Pendente
                  </span>
                )}
              </div>
            )}
          </div>

          <TabsContent value="entrada" className="mt-4 min-w-0 space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Field label="Responsável entrada *">
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
                  <Select value={form.status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            {isNovaDireto ? (
              <div className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-4">
                <ListaServicosEditor
                  servicosCatalogo={servicosCatalogo}
                  servicoCatalogoId={servicoCatalogoId}
                  onServicoCatalogoIdChange={setServicoCatalogoId}
                  onAdicionar={adicionarServicoSelecionado}
                  itens={itensServico}
                  total={totalServicos}
                  onAtualizarNome={atualizarNomeServico}
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

              <div className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-4">
                <ListaServicosEditor
                  servicosCatalogo={servicosCatalogo}
                  servicoCatalogoId={servicoCatalogoId}
                  onServicoCatalogoIdChange={setServicoCatalogoId}
                  onAdicionar={adicionarServicoSelecionado}
                  itens={itensServico}
                  total={totalServicos}
                  onAtualizarNome={atualizarNomeServico}
                  onAtualizarValor={atualizarValorItem}
                  onRemover={removerServico}
                />
              </div>

              <div className="min-w-0 space-y-4 rounded-xl border p-3 sm:p-4">
                <ListaPecasEditor
                  nome={nomePeca}
                  valor={valorPeca}
                  onNomeChange={setNomePeca}
                  onValorChange={setValorPeca}
                  onAdicionar={adicionarPeca}
                  itens={itensPecas}
                  total={totalPecas}
                  onAtualizarNome={atualizarNomePeca}
                  onAtualizarValor={atualizarValorPeca}
                  onRemover={removerPeca}
                />
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

          {!isNovaDireto && (
            <TabsContent value="aprovacao" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Responsável aprovação *">
                  {os && form.aprovado_por ? (
                    <Input type="text" readOnly disabled value={form.aprovado_por} />
                  ) : (
                    <Select value={form.aprovado_por || ""} onValueChange={(v) => set("aprovado_por", v)}>
                      <SelectTrigger><SelectValue placeholder="Quem aprovou a execução?" /></SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u: any) => {
                          const n = u.full_name ?? u.email;
                          return <SelectItem key={u.id} value={n}>{n}</SelectItem>;
                        })}
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

              <Field label="Histórico da Aprovação">
                {(() => {
                  const historico = parseHistoricoObsAprovacao(
                    form.observacoes_aprovacao,
                  );
                  if (historico.length === 0) {
                    return (
                      <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
                        Nenhum comentário ainda. Quando o cliente comentar no
                        portal, as entradas aparecem aqui com data.
                      </p>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {historico.map((entrada, idx) => (
                        <div
                          key={`${entrada.autor}-${entrada.data}-${idx}`}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-sm",
                            entrada.autor === "Cliente"
                              ? "border-amber-500/35 bg-amber-500/5"
                              : "bg-background",
                          )}
                        >
                          <p
                            className={cn(
                              "text-[11px] font-semibold uppercase tracking-wider",
                              entrada.autor === "Cliente"
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground",
                            )}
                          >
                            Comentário {entrada.autor}
                            {entrada.data ? ` · ${entrada.data}` : ""}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground">
                            {entrada.texto}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Field>

              <Field label="Nova observação da equipe">
                <Textarea
                  value={novaObsEquipe}
                  onChange={(e) => setNovaObsEquipe(e.target.value)}
                  placeholder="Será anexada ao histórico com data ao salvar…"
                />
              </Field>
            </TabsContent>
          )}

          <TabsContent value="execucao" className="space-y-4 mt-4">
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
              <Field label={`Próxima revisão recomendada${form.status === "pago" ? " *" : ""}`}>
                <Input
                  type="date"
                  required={form.status === "pago"}
                  value={form.proxima_revisao}
                  onChange={(e) => set("proxima_revisao", e.target.value)}
                />
                {form.status === "pago" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Obrigatório em Pago. Padrão: daqui a 3 meses.
                  </p>
                )}
              </Field>
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
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
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
            <span className="hidden sm:block" />
          )}
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" onClick={save} disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Lista de serviços do catálogo de preços: buscar, +, itens e total.
 * Permite CRUD dos itens já incluídos (nome, valor, remover).
 */
function ListaServicosEditor({
  servicosCatalogo,
  servicoCatalogoId,
  onServicoCatalogoIdChange,
  onAdicionar,
  itens,
  total,
  onAtualizarNome,
  onAtualizarValor,
  onRemover,
}: {
  servicosCatalogo: { id: string; nome: string; valor: number }[];
  servicoCatalogoId: string;
  onServicoCatalogoIdChange: (id: string) => void;
  onAdicionar: () => void;
  itens: ItemLinhaValor[];
  total: number;
  onAtualizarNome: (key: string, nome: string) => void;
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
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <Input
                className="h-8 min-w-0 flex-1 basis-[8rem]"
                value={item.nome}
                onChange={(e) => onAtualizarNome(item.key, e.target.value)}
                title="Nome do serviço"
              />
              <CurrencyInput
                className="h-8 w-full min-w-0 max-w-[8rem] sm:w-32"
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
 * Permite CRUD dos itens já incluídos (nome, valor, remover).
 */
function ListaPecasEditor({
  nome,
  valor,
  onNomeChange,
  onValorChange,
  onAdicionar,
  itens,
  total,
  onAtualizarNome,
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
  onAtualizarNome: (key: string, nome: string) => void;
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
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2"
            >
              <Input
                className="h-8 min-w-0 flex-1 basis-[8rem]"
                value={item.nome}
                onChange={(e) => onAtualizarNome(item.key, e.target.value)}
                title="Nome da peça"
              />
              <CurrencyInput
                className="h-8 w-full min-w-0 max-w-[8rem] sm:w-32"
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
