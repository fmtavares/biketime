import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileUp, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CompraFormDialog } from "@/components/CompraFormDialog";
import { ImportarNfeCompraDialog } from "@/components/ImportarNfeCompraDialog";
import { fmtDataCurtaYY } from "@/lib/datas";
import { fmtBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/compras")({
  validateSearch: (s: Record<string, unknown>) => ({
    fornecedor: typeof s.fornecedor === "string" ? s.fornecedor : undefined,
  }),
  component: ComprasPage,
});

type FiltroStatus = "todas" | "em_aberto" | "quitadas";

/**
 * Histórico de compras (todas ficam visíveis, mesmo quitadas).
 * Pagamento de parcelas fica em /contas-a-pagar.
 */
function ComprasPage() {
  const { fornecedor: fornecedorSearch } = Route.useSearch();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtroForn, setFiltroForn] = useState(fornecedorSearch ?? "");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  /** Atualiza listas após salvar/importar compra. */
  function invalidateCompras() {
    qc.invalidateQueries({ queryKey: ["compras-list"] });
    qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    qc.invalidateQueries({ queryKey: ["fornecedor-compras"] });
    qc.invalidateQueries({ queryKey: ["fechamento"] });
    qc.invalidateQueries({ queryKey: ["fornecedores-select"] });
    qc.invalidateQueries({ queryKey: ["fornecedores"] });
  }

  /** Abre o dialog da compra clicada na listagem. */
  function abrirCompra(id: string) {
    setEditId(id);
    setOpen(true);
  }

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

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select(
          "*, fornecedores(id, nome, nome_fantasia), compra_parcelas(id, numero, valor, data_vencimento, status), compra_itens(id, descricao)",
        )
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return compras.filter((c: any) => {
      if (filtroForn && c.fornecedor_id !== filtroForn) return false;

      const pars: any[] = c.compra_parcelas ?? [];
      const temAberta = pars.some((p) => p.status === "aberta");
      if (filtroStatus === "em_aberto" && !temAberta) return false;
      if (filtroStatus === "quitadas" && (temAberta || !pars.length)) return false;

      const s = q.toLowerCase().trim();
      if (!s) return true;
      const nome = c.fornecedores?.nome ?? "";
      const fantasia = c.fornecedores?.nome_fantasia ?? "";
      const itens = (c.compra_itens ?? []).map((i: any) => i.descricao).join(" ");
      return `${nome} ${fantasia} ${c.numero_nf ?? ""} ${c.forma_pagamento} ${itens}`
        .toLowerCase()
        .includes(s);
    });
  }, [compras, filtroForn, filtroStatus, q]);

  /**
   * Resumo de parcelas da compra para badges de status.
   */
  function resumoParcelas(pars: any[]) {
    const total = pars.length;
    const pagas = pars.filter((p) => p.status === "paga").length;
    const abertas = pars
      .filter((p) => p.status === "aberta")
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    const prox = abertas[0];
    const quitada = total > 0 && pagas === total;
    return { total, pagas, prox, quitada };
  }

  /**
   * Exclui compra e cascata (itens + parcelas). Só admin.
   */
  async function excluirCompra(c: any) {
    if (!isAdmin) return toast.error("Somente administradores");
    const nf = c.numero_nf ? ` NF ${c.numero_nf}` : "";
    const forn = c.fornecedores?.nome ?? "fornecedor";
    if (
      !confirm(
        `Excluir a compra${nf} de ${forn}?\nItens e parcelas também serão removidos.`,
      )
    ) {
      return;
    }
    const { error } = await supabase.from("compras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Compra excluída");
    invalidateCompras();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Compras"
        description="Histórico de compras por fornecedor"
        action={
          isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="size-4" /> Importar XML
              </Button>
              <Button
                onClick={() => {
                  setEditId(null);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> Nova compra
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="max-w-md flex-1">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar fornecedor, NF, item…"
          />
        </div>
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
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["todas", "Todas"],
            ["em_aberto", "Em aberto"],
            ["quitadas", "Quitadas"],
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
            {filtered.map((c: any) => {
              const { total, pagas, prox, quitada } = resumoParcelas(
                c.compra_parcelas ?? [],
              );
              const vencida = prox && prox.data_vencimento < today;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="space-y-2 rounded-xl border bg-card p-4 text-sm cursor-pointer transition-colors hover:bg-secondary/30"
                  onClick={() => abrirCompra(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrirCompra(c.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="whitespace-nowrap text-muted-foreground">
                        {fmtDataCurtaYY(c.data_compra)}
                      </div>
                      <div className="truncate text-muted-foreground">
                        {c.numero_nf ? `NF ${c.numero_nf}` : "Sem NF"}
                      </div>
                      <div
                        className="truncate font-medium"
                        title={
                          c.fornecedores?.nome_fantasia ||
                          c.fornecedores?.nome ||
                          undefined
                        }
                      >
                        {c.fornecedores?.nome_fantasia ||
                          c.fornecedores?.nome ||
                          "—"}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {quitada ? (
                        <Badge variant="secondary">Quitada</Badge>
                      ) : (
                        <Badge variant="outline">
                          {pagas}/{total}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Total</div>
                      <div className="tabular-nums whitespace-nowrap">
                        {fmtBRL(Number(c.valor_total) || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Parcela</div>
                      {prox ? (
                        <div
                          className={`whitespace-nowrap tabular-nums ${
                            vencida ? "text-destructive" : ""
                          }`}
                        >
                          {fmtBRL(Number(prox.valor) || 0)}
                          {" · "}
                          {fmtDataCurtaYY(prox.data_vencimento)}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">—</div>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex flex-wrap gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => excluirCompra(c)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    {prox && (
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          to="/contas-a-pagar"
                          search={{ fornecedor: c.fornecedor_id }}
                        >
                          Parcelas
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl">
                Nenhuma compra encontrada.
              </div>
            )}
          </div>

          <div className="hidden lg:block overflow-hidden rounded-xl border bg-card">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[24%]" />
                <col className="w-[13%]" />
                <col className="w-[18%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">NF</th>
                  <th className="px-3 py-3 text-left">Fornecedor</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3 text-left">Parcela</th>
                  <th className="px-3 py-3 text-left">Status</th>
                  <th className="px-2 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const { total, pagas, prox, quitada } = resumoParcelas(
                    c.compra_parcelas ?? [],
                  );
                  const vencida = prox && prox.data_vencimento < today;
                  const nomeForn =
                    c.fornecedores?.nome_fantasia ||
                    c.fornecedores?.nome ||
                    "—";
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-t transition-colors hover:bg-secondary/30"
                      onClick={() => abrirCompra(c.id)}
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                        {fmtDataCurtaYY(c.data_compra)}
                      </td>
                      <td className="min-w-0 px-3 py-3 whitespace-nowrap text-muted-foreground">
                        <div className="truncate" title={c.numero_nf || undefined}>
                          {c.numero_nf || "—"}
                        </div>
                      </td>
                      <td className="min-w-0 px-3 py-3">
                        <div className="truncate font-medium" title={nomeForn}>
                          {nomeForn}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                        {fmtBRL(Number(c.valor_total) || 0)}
                      </td>
                      <td className="min-w-0 px-3 py-3">
                        {prox ? (
                          <div
                            className={`truncate whitespace-nowrap tabular-nums ${
                              vencida ? "text-destructive" : "text-muted-foreground"
                            }`}
                          >
                            {fmtBRL(Number(prox.valor) || 0)}
                            {" · "}
                            {fmtDataCurtaYY(prox.data_vencimento)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {quitada ? (
                          <Badge variant="secondary">Quitada</Badge>
                        ) : (
                          <Badge variant="outline">
                            {pagas}/{total}
                          </Badge>
                        )}
                      </td>
                      <td
                        className="px-2 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-0.5">
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Excluir compra"
                              onClick={() => excluirCompra(c)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                          {prox && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Parcelas em aberto"
                              asChild
                            >
                              <Link
                                to="/contas-a-pagar"
                                search={{ fornecedor: c.fornecedor_id }}
                              >
                                <Wallet className="size-3.5" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Nenhuma compra encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CompraFormDialog
        open={open}
        onOpenChange={setOpen}
        compraId={editId}
        defaultFornecedorId={filtroForn || fornecedorSearch || null}
        onSaved={invalidateCompras}
      />

      <ImportarNfeCompraDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSaved={invalidateCompras}
      />
    </div>
  );
}
