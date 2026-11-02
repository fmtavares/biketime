import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/vendas/indicacoes")({
  component: IndicacoesPage,
});

const statusLabel: Record<string, string> = {
  aguardando_loja: "Aguardando a loja",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

type PedidoIndicacao = {
  id: string;
  numero: number;
  status: string;
  desconto: number;
  total: number;
  codigo_cupom: string | null;
  created_at: string;
  clientes: { nome?: string } | null;
  parceiros: { nome?: string } | null;
  pedido_itens: { id: string; nome: string; tamanho: string | null; quantidade: number }[] | null;
};

/**
 * Converte o dia escolhido no filtro para o instante em São Paulo.
 * `fim` usa o último milissegundo do dia.
 */
function limiteDiaSp(data: string, fim: boolean) {
  const hora = fim ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${data}T${hora}-03:00`).toISOString();
}

/**
 * Soma só os pedidos que não foram cancelados.
 * A lista continua mostrando os cancelados; a soma não.
 */
function somarIndicacoes(pedidos: PedidoIndicacao[]) {
  const validos = pedidos.filter((p) => p.status !== "cancelado");
  return {
    quantidade: validos.length,
    total: validos.reduce((s, p) => s + (Number(p.total) || 0), 0),
    desconto: validos.reduce((s, p) => s + (Number(p.desconto) || 0), 0),
    cancelados: pedidos.length - validos.length,
  };
}

/**
 * Lista as vendas do showroom por parceiro, cupom e período.
 * O nome do parceiro fica só nesta área da equipe.
 */
function IndicacoesPage() {
  const { isAdmin } = useAuth();
  const [parceiroId, setParceiroId] = useState("");
  const [cupomId, setCupomId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiros").select("id, nome, ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cupons = [] } = useQuery({
    queryKey: ["cupons-indicacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cupons")
        .select("id, codigo, parceiro_id, ativo, parceiros(nome)")
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const cuponsDoFiltro = parceiroId ? cupons.filter((c) => c.parceiro_id === parceiroId) : cupons;

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["indicacoes", parceiroId, cupomId, de, ate],
    queryFn: async () => {
      let q = supabase
        .from("pedidos")
        .select(
          "id, numero, status, desconto, total, codigo_cupom, created_at, clientes(nome), parceiros(nome), pedido_itens(id, nome, tamanho, quantidade)",
        )
        .order("created_at", { ascending: false });
      if (parceiroId) q = q.eq("parceiro_id", parceiroId);
      if (cupomId) q = q.eq("cupom_id", cupomId);
      if (de) q = q.gte("created_at", limiteDiaSp(de, false));
      if (ate) q = q.lte("created_at", limiteDiaSp(ate, true));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PedidoIndicacao[];
    },
  });

  const soma = useMemo(() => somarIndicacoes(pedidos), [pedidos]);
  const periodoInvalido = Boolean(de && ate && de > ate);

  /**
   * Troca o parceiro e solta o cupom se ele for de outra pessoa.
   */
  function aoMudarParceiro(id: string) {
    setParceiroId(id);
    setCupomId((atual) => {
      if (!id || !atual) return atual;
      const cupom = cupons.find((c) => c.id === atual);
      return cupom && cupom.parceiro_id !== id ? "" : atual;
    });
  }

  /** Zera parceiro, cupom e o intervalo de datas. */
  function limparFiltros() {
    setParceiroId("");
    setCupomId("");
    setDe("");
    setAte("");
  }

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores.</p>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-display font-bold sm:text-2xl">Indicações</h1>
        <p className="text-sm text-muted-foreground">
          Vendas do showroom por parceiro, cupom e período. Pedido cancelado aparece na lista e fica fora da soma.
        </p>
      </header>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          Parceiro
          <select
            value={parceiroId}
            onChange={(e) => aoMudarParceiro(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todos</option>
            {parceiros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Cupom
          <select
            value={cupomId}
            onChange={(e) => setCupomId(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todos</option>
            {cuponsDoFiltro.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
                {(c.parceiros as { nome?: string } | null)?.nome
                  ? ` · ${(c.parceiros as { nome: string }).nome}`
                  : ""}
                {c.ativo ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          De
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground"
          />
        </label>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <button type="button" onClick={limparFiltros} className="h-9 rounded-md border px-3 text-sm">
            Limpar filtros
          </button>
        </div>
      </div>
      {periodoInvalido && (
        <p className="text-sm text-muted-foreground">A data inicial está depois da data final.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Resumo rotulo="Pedidos" valor={String(soma.quantidade)} />
        <Resumo rotulo="Total vendido" valor={fmtBRL(soma.total)} />
        <Resumo rotulo="Desconto" valor={fmtBRL(soma.desconto)} />
      </div>
      {soma.cancelados > 0 && (
        <p className="text-xs text-muted-foreground">
          {soma.cancelados === 1
            ? "1 pedido cancelado fora da soma."
            : `${soma.cancelados} pedidos cancelados fora da soma.`}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : pedidos.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido neste filtro.</p>
      ) : (
        <div className="grid gap-3">
          {pedidos.map((p) => (
            <article
              key={p.id}
              className={`rounded-xl border p-4 ${p.status === "cancelado" ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    #{p.numero} · {p.clientes?.nome ?? "Cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.codigo_cupom ? ` · Cupom ${p.codigo_cupom}` : " · Sem cupom"}
                    {p.parceiros?.nome ? ` · ${p.parceiros.nome}` : ""}
                    {` · ${statusLabel[p.status] ?? p.status}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{fmtBRL(Number(p.total) || 0)}</p>
                  {Number(p.desconto) > 0 && (
                    <p className="text-xs text-muted-foreground">Desconto {fmtBRL(Number(p.desconto))}</p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {(p.pedido_itens ?? []).map((i) => (
                  <li key={i.id}>
                    {i.nome}
                    {i.tamanho ? ` · ${i.tamanho}` : ""} × {Number(i.quantidade)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Número do resumo no topo da listagem. */
function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  );
}
