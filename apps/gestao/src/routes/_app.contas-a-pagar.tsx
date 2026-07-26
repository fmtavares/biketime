import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { CompraFormDialog } from "@/components/CompraFormDialog";
import { DespesaFormDialog } from "@/components/DespesaFormDialog";
import { fmtBRL } from "@/lib/finance";
import { competenciaAtual } from "@/lib/despesas";
import { garantirLancamentosDoMes } from "@/lib/despesas-gerar";
import { agoraComoPagamentoISO } from "@/lib/datas";

export const Route = createFileRoute("/_app/contas-a-pagar")({
  validateSearch: (s: Record<string, unknown>) => ({
    fornecedor: typeof s.fornecedor === "string" ? s.fornecedor : undefined,
  }),
  component: ContasAPagarPage,
});

type FiltroChip = "abertas" | "vencidas";
type FiltroOrigem = "todas" | "compra" | "operacional";

type ItemAgenda =
  | {
      key: string;
      origem: "compra";
      id: string;
      data_vencimento: string;
      valor: number;
      titulo: string;
      detalhe: string;
      forma_pagamento: string;
      fornecedor_id: string;
      compra_id: string;
      numero: number;
    }
  | {
      key: string;
      origem: "operacional";
      id: string;
      data_vencimento: string;
      valor: number;
      titulo: string;
      detalhe: string;
      forma_pagamento: string;
      despesa: any;
    };

/**
 * Agenda unificada de saídas: parcelas de compra + despesas operacionais previstas.
 */
function ContasAPagarPage() {
  const { fornecedor: fornecedorSearch } = Route.useSearch();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtroForn, setFiltroForn] = useState(fornecedorSearch ?? "");
  const [filtroChip, setFiltroChip] = useState<FiltroChip>("abertas");
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>("todas");
  const [editCompraId, setEditCompraId] = useState<string | null>(null);
  const [openCompra, setOpenCompra] = useState(false);
  const [editDespesa, setEditDespesa] = useState<any | null>(null);
  const [openDespesa, setOpenDespesa] = useState(false);
  const syncedCompetencia = useRef<string | null>(null);

  /** Sincroniza filtro de fornecedor com o query param da URL. */
  useEffect(() => {
    if (fornecedorSearch) setFiltroForn(fornecedorSearch);
  }, [fornecedorSearch]);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: parcelas = [], isLoading: loadingParcelas } = useQuery({
    queryKey: ["contas-a-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compra_parcelas")
        .select(
          "id, numero, valor, data_vencimento, status, compra_id, compras(id, data_compra, numero_nf, forma_pagamento, fornecedor_id, fornecedores(id, nome))",
        )
        .eq("status", "aberta")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((p: any): Extract<ItemAgenda, { origem: "compra" }> => {
        const compra = p.compras;
        const fornNome = compra?.fornecedores?.nome ?? "—";
        const nf = compra?.numero_nf ? `NF ${compra.numero_nf}` : null;
        return {
          key: `compra-${p.id}`,
          origem: "compra",
          id: p.id,
          data_vencimento: p.data_vencimento,
          valor: Number(p.valor) || 0,
          titulo: fornNome,
          detalhe: [`Parcela #${p.numero}`, compra?.forma_pagamento, nf]
            .filter(Boolean)
            .join(" · "),
          forma_pagamento: compra?.forma_pagamento ?? "",
          fornecedor_id: compra?.fornecedor_id ?? "",
          compra_id: p.compra_id,
          numero: p.numero,
        };
      });
    },
  });

  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["contas-a-pagar-despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, despesa_categorias(id, nome)")
        .eq("status", "prevista")
        .order("data_vencimento", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((d: any): Extract<ItemAgenda, { origem: "operacional" }> => {
        const cat = d.despesa_categorias?.nome ?? "Operacional";
        return {
          key: `op-${d.id}`,
          origem: "operacional",
          id: d.id,
          data_vencimento: d.data_vencimento,
          valor: Number(d.valor) || 0,
          titulo: d.descricao,
          detalhe: [cat, d.recorrente_id ? "Recorrente" : null, d.forma_pagamento]
            .filter(Boolean)
            .join(" · "),
          forma_pagamento: d.forma_pagamento ?? "",
          despesa: d,
        };
      });
    },
  });

  /**
   * Garante lançamentos do mês atual a partir das recorrentes ativas.
   */
  useEffect(() => {
    if (!isAdmin) return;
    const competencia = competenciaAtual();
    if (syncedCompetencia.current === competencia) return;

    const [y, m] = competencia.split("-").map(Number);
    let cancelled = false;
    (async () => {
      const result = await garantirLancamentosDoMes({
        ano: y,
        mes: m,
        createdBy: user?.id ?? null,
      });
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
        return;
      }
      syncedCompetencia.current = competencia;
      if (result.criados > 0) {
        qc.invalidateQueries({ queryKey: ["contas-a-pagar-despesas"] });
        qc.invalidateQueries({ queryKey: ["despesas-list"] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, user?.id, qc]);

  const today = new Date().toISOString().slice(0, 10);

  const agenda = useMemo(() => {
    const list: ItemAgenda[] = [...parcelas, ...despesas];
    list.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    return list;
  }, [parcelas, despesas]);

  const filtered = useMemo(() => {
    return agenda.filter((item) => {
      if (filtroOrigem !== "todas" && item.origem !== filtroOrigem) return false;
      if (
        item.origem === "compra" &&
        filtroForn &&
        item.fornecedor_id !== filtroForn
      ) {
        return false;
      }
      if (filtroChip === "vencidas" && item.data_vencimento >= today) return false;

      const s = q.toLowerCase().trim();
      if (!s) return true;
      return `${item.titulo} ${item.detalhe} ${item.forma_pagamento}`
        .toLowerCase()
        .includes(s);
    });
  }, [agenda, filtroOrigem, filtroForn, filtroChip, q, today]);

  const totais = useMemo(() => {
    let emAberto = 0;
    let vencido = 0;
    let compras = 0;
    let operacional = 0;
    for (const item of filtered) {
      emAberto += item.valor;
      if (item.data_vencimento < today) vencido += item.valor;
      if (item.origem === "compra") compras += item.valor;
      else operacional += item.valor;
    }
    return { emAberto, vencido, compras, operacional };
  }, [filtered, today]);

  /**
   * Marca parcela de compra como paga.
   */
  async function pagarCompra(parcelaId: string) {
    if (!isAdmin) return toast.error("Somente administradores");
    const { error } = await supabase
      .from("compra_parcelas")
      .update({ status: "paga", data_pagamento: agoraComoPagamentoISO() })
      .eq("id", parcelaId);
    if (error) return toast.error(error.message);
    toast.success("Parcela marcada como paga");
    qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    qc.invalidateQueries({ queryKey: ["compras-list"] });
    qc.invalidateQueries({ queryKey: ["fornecedor-compras"] });
    qc.invalidateQueries({ queryKey: ["fechamento"] });
  }

  /**
   * Marca despesa operacional como paga (pede valor se estiver zerado).
   */
  async function pagarDespesa(d: any) {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!(Number(d.valor) > 0)) {
      setEditDespesa({ ...d, status: "paga" });
      setOpenDespesa(true);
      return toast.message("Informe o valor da fatura antes de marcar como paga");
    }
    const { error } = await supabase
      .from("despesas")
      .update({ status: "paga", data_pagamento: agoraComoPagamentoISO() })
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Despesa marcada como paga");
    qc.invalidateQueries({ queryKey: ["contas-a-pagar-despesas"] });
    qc.invalidateQueries({ queryKey: ["despesas-list"] });
    qc.invalidateQueries({ queryKey: ["fechamento"] });
  }

  const isLoading = loadingParcelas || loadingDespesas;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="A Pagar"
        description="Agenda de saídas: compras e despesas operacionais"
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditDespesa(null);
                setOpenDespesa(true);
              }}
            >
              <Plus className="size-4" /> Nova despesa
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TotCard label="Em aberto" value={totais.emAberto} />
        <TotCard label="Vencido" value={totais.vencido} danger />
        <TotCard label="Compras" value={totais.compras} />
        <TotCard label="Operacional" value={totais.operacional} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="max-w-md flex-1">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar fornecedor, despesa, NF…"
          />
        </div>
        {(filtroOrigem === "todas" || filtroOrigem === "compra") && (
          <select
            value={filtroForn}
            onChange={(e) => setFiltroForn(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["todas", "Tudo"],
            ["compra", "Compras"],
            ["operacional", "Operacional"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={filtroOrigem === k ? "default" : "outline"}
            onClick={() => setFiltroOrigem(k)}
          >
            {label}
          </Button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:inline-block" />
        {(
          [
            ["abertas", "Abertas"],
            ["vencidas", "Vencidas"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            size="sm"
            variant={filtroChip === k ? "default" : "outline"}
            onClick={() => setFiltroChip(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {filtered.map((item) => {
              const vencida = item.data_vencimento < today;
              return (
                <div key={item.key} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <OrigemBadge origem={item.origem} />
                        {item.origem === "compra" && item.fornecedor_id ? (
                          <Link
                            to="/fornecedores/$id"
                            params={{ id: item.fornecedor_id }}
                            className="font-medium hover:underline"
                          >
                            {item.titulo}
                          </Link>
                        ) : (
                          <span className="font-medium">{item.titulo}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {item.detalhe}
                      </div>
                    </div>
                    <div className="font-semibold">{fmtBRL(item.valor)}</div>
                  </div>
                  <Badge variant={vencida ? "destructive" : "outline"}>
                    Venc.{" "}
                    {new Date(item.data_vencimento + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )}
                  </Badge>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          item.origem === "compra"
                            ? pagarCompra(item.id)
                            : pagarDespesa(item.despesa)
                        }
                      >
                        <Check className="size-3.5" /> Marcar paga
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (item.origem === "compra") {
                            setEditCompraId(item.compra_id);
                            setOpenCompra(true);
                          } else {
                            setEditDespesa(item.despesa);
                            setOpenDespesa(true);
                          }
                        }}
                      >
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl">
                Nada em aberto nesta agenda.
              </div>
            )}
          </div>

          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-left px-4 py-3">Descrição</th>
                  <th className="text-left px-4 py-3">Detalhe</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  {isAdmin && <th className="text-right px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const vencida = item.data_vencimento < today;
                  return (
                    <tr
                      key={item.key}
                      className="border-t hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={
                            vencida
                              ? "text-destructive font-medium"
                              : "text-muted-foreground"
                          }
                        >
                          {new Date(
                            item.data_vencimento + "T12:00:00",
                          ).toLocaleDateString("pt-BR")}
                        </span>
                        {vencida && (
                          <Badge variant="destructive" className="ml-2">
                            Vencida
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <OrigemBadge origem={item.origem} />
                      </td>
                      <td className="px-4 py-3">
                        {item.origem === "compra" && item.fornecedor_id ? (
                          <Link
                            to="/fornecedores/$id"
                            params={{ id: item.fornecedor_id }}
                            className="font-medium hover:underline"
                          >
                            {item.titulo}
                          </Link>
                        ) : (
                          <span className="font-medium">{item.titulo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.detalhe}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {fmtBRL(item.valor)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              onClick={() =>
                                item.origem === "compra"
                                  ? pagarCompra(item.id)
                                  : pagarDespesa(item.despesa)
                              }
                            >
                              <Check className="size-3.5" /> Pagar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (item.origem === "compra") {
                                  setEditCompraId(item.compra_id);
                                  setOpenCompra(true);
                                } else {
                                  setEditDespesa(item.despesa);
                                  setOpenDespesa(true);
                                }
                              }}
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Nada em aberto nesta agenda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CompraFormDialog
        open={openCompra}
        onOpenChange={setOpenCompra}
        compraId={editCompraId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
          qc.invalidateQueries({ queryKey: ["compras-list"] });
        }}
      />
      <DespesaFormDialog
        open={openDespesa}
        onOpenChange={setOpenDespesa}
        despesa={editDespesa}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["contas-a-pagar-despesas"] });
          qc.invalidateQueries({ queryKey: ["despesas-list"] });
        }}
      />
    </div>
  );
}

/** Badge de origem do item na agenda. */
function OrigemBadge({ origem }: { origem: "compra" | "operacional" }) {
  return origem === "compra" ? (
    <Badge variant="secondary">Compra</Badge>
  ) : (
    <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
      Operacional
    </Badge>
  );
}

/** Card de total no topo da agenda. */
function TotCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-display font-bold ${
          danger ? "text-destructive" : ""
        }`}
      >
        {fmtBRL(value)}
      </div>
    </div>
  );
}
