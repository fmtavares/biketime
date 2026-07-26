import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Check, Repeat, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { DespesaFormDialog } from "@/components/DespesaFormDialog";
import { DespesaRecorrenteFormDialog } from "@/components/DespesaRecorrenteFormDialog";
import { DespesaCalendarioDialog } from "@/components/DespesaCalendarioDialog";
import { fmtBRL } from "@/lib/finance";
import {
  competenciaAtual,
  competenciaMes,
  labelCompetencia,
} from "@/lib/despesas";
import { garantirLancamentosDoMes } from "@/lib/despesas-gerar";
import { agoraComoPagamentoISO } from "@/lib/datas";

export const Route = createFileRoute("/_app/despesas")({
  component: DespesasPage,
});

type Aba = "lancamentos" | "recorrentes";
type FiltroStatus = "previstas" | "vencidas" | "pagas" | "todas";

/**
 * Despesas do dia a dia + modelos recorrentes (lançamentos gerados automaticamente).
 */
function DespesasPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("lancamentos");
  const [q, setQ] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("previstas");
  const [mesRef, setMesRef] = useState(() => {
    const c = competenciaAtual();
    return c.slice(0, 7); // YYYY-MM
  });
  const [openDespesa, setOpenDespesa] = useState(false);
  const [editDespesa, setEditDespesa] = useState<any | null>(null);
  const [openRec, setOpenRec] = useState(false);
  const [editRec, setEditRec] = useState<any | null>(null);
  const [openCalendario, setOpenCalendario] = useState(false);
  /** Evita re-sync redundante do mesmo mês na mesma sessão de visualização. */
  const syncedCompetencia = useRef<string | null>(null);

  const [ano, mes] = mesRef.split("-").map(Number);
  const competencia = competenciaMes(ano, mes);
  const today = new Date().toISOString().slice(0, 10);

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["despesas-list", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, despesa_categorias(id, nome)")
        .eq("competencia", competencia)
        .order("data_vencimento");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recorrentes = [], isFetched: recorrentesFetched } = useQuery({
    queryKey: ["despesa-recorrentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesa_recorrentes")
        .select("*, despesa_categorias(id, nome)")
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * Ao abrir a tela ou mudar o mês, gera automaticamente as previstas dos recorrentes ativos.
   */
  useEffect(() => {
    if (!isAdmin || !recorrentesFetched) return;
    if (syncedCompetencia.current === competencia) return;

    let cancelled = false;
    (async () => {
      const result = await garantirLancamentosDoMes({
        ano,
        mes,
        createdBy: user?.id ?? null,
      });
      if (cancelled) return;
      if (result.error) {
        toast.error(result.error);
        return;
      }
      syncedCompetencia.current = competencia;
      if (result.criados > 0) {
        qc.invalidateQueries({ queryKey: ["despesas-list", competencia] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, recorrentesFetched, competencia, ano, mes, user?.id, qc]);

  const filtered = useMemo(() => {
    return despesas.filter((d: any) => {
      if (filtroStatus === "previstas" && d.status !== "prevista") return false;
      if (filtroStatus === "pagas" && d.status !== "paga") return false;
      if (
        filtroStatus === "vencidas" &&
        !(d.status === "prevista" && d.data_vencimento < today)
      ) {
        return false;
      }
      const s = q.toLowerCase().trim();
      if (!s) return true;
      const cat = d.despesa_categorias?.nome ?? "";
      return `${d.descricao} ${cat} ${d.forma_pagamento ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [despesas, filtroStatus, q, today]);

  const totais = useMemo(() => {
    let previstas = 0;
    let pagas = 0;
    let vencidas = 0;
    for (const d of despesas as any[]) {
      const v = Number(d.valor) || 0;
      if (d.status === "paga") pagas += v;
      else {
        previstas += v;
        if (d.data_vencimento < today) vencidas += v;
      }
    }
    return { previstas, pagas, vencidas };
  }, [despesas, today]);

  /**
   * Marca despesa como paga (abre edição se valor zerado).
   */
  async function marcarPaga(d: any) {
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
    qc.invalidateQueries({ queryKey: ["despesas-list", competencia] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Despesas"
        description="Cadastro e recorrentes — a agenda do dia a dia fica em A Pagar"
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {aba === "lancamentos" && (
              <Button
                variant="outline"
                onClick={() => setOpenCalendario(true)}
              >
                <CalendarDays className="size-4" /> Programação do mês
              </Button>
            )}
            {isAdmin &&
              (aba === "lancamentos" ? (
                <Button
                  onClick={() => {
                    setEditDespesa(null);
                    setOpenDespesa(true);
                  }}
                >
                  <Plus className="size-4" /> Nova despesa
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setEditRec(null);
                    setOpenRec(true);
                  }}
                >
                  <Plus className="size-4" /> Nova recorrente
                </Button>
              ))}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={aba === "lancamentos" ? "default" : "outline"}
          onClick={() => setAba("lancamentos")}
        >
          Lançamentos
        </Button>
        <Button
          size="sm"
          variant={aba === "recorrentes" ? "default" : "outline"}
          onClick={() => setAba("recorrentes")}
        >
          <Repeat className="size-3.5" /> Recorrentes
        </Button>
      </div>

      {aba === "lancamentos" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Previstas · {labelCompetencia(competencia)}
              </div>
              <div className="mt-1 text-xl font-display font-bold">
                {fmtBRL(totais.previstas)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Vencidas
              </div>
              <div className="mt-1 text-xl font-display font-bold text-destructive">
                {fmtBRL(totais.vencidas)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Pagas no mês
              </div>
              <div className="mt-1 text-xl font-display font-bold">
                {fmtBRL(totais.pagas)}
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="max-w-md flex-1">
              <SearchBar
                value={q}
                onChange={setQ}
                placeholder="Buscar descrição, categoria…"
              />
            </div>
            <InputMes value={mesRef} onChange={setMesRef} />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["previstas", "Previstas"],
                ["vencidas", "Vencidas"],
                ["pagas", "Pagas"],
                ["todas", "Todas"],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={filtroStatus === k ? "default" : "outline"}
                onClick={() => setFiltroStatus(k)}
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
                {filtered.map((d: any) => {
                  const vencida =
                    d.status === "prevista" && d.data_vencimento < today;
                  return (
                    <div
                      key={d.id}
                      className="rounded-xl border bg-card p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{d.descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            {d.despesa_categorias?.nome ?? "Sem categoria"}
                            {d.recorrente_id ? " · Recorrente" : ""}
                          </div>
                        </div>
                        <div className="font-semibold">
                          {fmtBRL(Number(d.valor) || 0)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {d.status === "paga" ? (
                          <Badge variant="secondary">Paga</Badge>
                        ) : (
                          <Badge variant={vencida ? "destructive" : "outline"}>
                            {vencida ? "Vencida" : "Prevista"} ·{" "}
                            {new Date(
                              d.data_vencimento + "T12:00:00",
                            ).toLocaleDateString("pt-BR")}
                          </Badge>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditDespesa(d);
                              setOpenDespesa(true);
                            }}
                          >
                            Editar
                          </Button>
                          {d.status === "prevista" && (
                            <Button size="sm" onClick={() => marcarPaga(d)}>
                              <Check className="size-3.5" /> Pagar
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground border rounded-xl">
                    Nenhuma despesa neste mês. Cadastre uma recorrente ou use “Nova despesa”.
                  </div>
                )}
              </div>

              <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Vencimento</th>
                      <th className="text-left px-4 py-3">Descrição</th>
                      <th className="text-left px-4 py-3">Categoria</th>
                      <th className="text-left px-4 py-3">Valor</th>
                      <th className="text-left px-4 py-3">Status</th>
                      {isAdmin && (
                        <th className="text-right px-4 py-3">Ações</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d: any) => {
                      const vencida =
                        d.status === "prevista" && d.data_vencimento < today;
                      return (
                        <tr
                          key={d.id}
                          className="border-t hover:bg-secondary/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(
                              d.data_vencimento + "T12:00:00",
                            ).toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{d.descricao}</div>
                            {d.recorrente_id && (
                              <div className="text-xs text-muted-foreground">
                                Recorrente
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {d.despesa_categorias?.nome ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {fmtBRL(Number(d.valor) || 0)}
                          </td>
                          <td className="px-4 py-3">
                            {d.status === "paga" ? (
                              <Badge variant="secondary">Paga</Badge>
                            ) : (
                              <Badge
                                variant={vencida ? "destructive" : "outline"}
                              >
                                {vencida ? "Vencida" : "Prevista"}
                              </Badge>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditDespesa(d);
                                    setOpenDespesa(true);
                                  }}
                                >
                                  Editar
                                </Button>
                                {d.status === "prevista" && (
                                  <Button
                                    size="sm"
                                    onClick={() => marcarPaga(d)}
                                  >
                                    <Check className="size-3.5" /> Pagar
                                  </Button>
                                )}
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
                          Nenhuma despesa neste mês. Cadastre uma recorrente ou
                          use “Nova despesa”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-2">
            Cadastre contas fixas (luz, água…). Os lançamentos do mês aparecem
            sozinhos; no dia do pagamento, atualize o valor e marque como paga.
          </p>
          {(recorrentes as any[]).map((r) => (
            <div
              key={r.id}
              className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium flex flex-wrap items-center gap-2">
                  {r.descricao}
                  {r.ativo ? (
                    <Badge variant="secondary">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Todo dia {r.dia_vencimento}
                  {r.despesa_categorias?.nome
                    ? ` · ${r.despesa_categorias.nome}`
                    : ""}
                  {r.valor_estimado != null
                    ? ` · est. ${fmtBRL(Number(r.valor_estimado))}`
                    : ""}
                  {r.forma_pagamento ? ` · ${r.forma_pagamento}` : ""}
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditRec(r);
                    setOpenRec(true);
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
          ))}
          {recorrentes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border rounded-xl">
              Nenhuma despesa recorrente cadastrada.
            </div>
          )}
        </div>
      )}

      <DespesaCalendarioDialog
        open={openCalendario}
        onOpenChange={setOpenCalendario}
        mesRef={mesRef}
        competencia={competencia}
        despesas={despesas as any[]}
        today={today}
        onSelect={(d) => {
          if (!isAdmin) return;
          setEditDespesa(d);
          setOpenDespesa(true);
        }}
      />
      <DespesaFormDialog
        open={openDespesa}
        onOpenChange={setOpenDespesa}
        despesa={editDespesa}
        onSaved={() =>
          qc.invalidateQueries({ queryKey: ["despesas-list", competencia] })
        }
      />
      <DespesaRecorrenteFormDialog
        open={openRec}
        onOpenChange={setOpenRec}
        recorrente={editRec}
        onSaved={async () => {
          syncedCompetencia.current = null;
          await garantirLancamentosDoMes({
            ano,
            mes,
            createdBy: user?.id ?? null,
          });
          syncedCompetencia.current = competencia;
          qc.invalidateQueries({ queryKey: ["despesa-recorrentes"] });
          qc.invalidateQueries({ queryKey: ["despesas-list", competencia] });
        }}
      />
    </div>
  );
}

/**
 * Seletor de mês (YYYY-MM) para filtrar competência.
 */
function InputMes({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border bg-background px-3 text-sm"
    />
  );
}
