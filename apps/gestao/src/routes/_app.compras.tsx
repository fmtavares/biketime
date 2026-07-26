import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CompraFormDialog } from "@/components/CompraFormDialog";
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
          "*, fornecedores(id, nome), compra_parcelas(id, numero, valor, data_vencimento, status), compra_itens(id, descricao)",
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
      const itens = (c.compra_itens ?? []).map((i: any) => i.descricao).join(" ");
      return `${nome} ${c.numero_nf ?? ""} ${c.forma_pagamento} ${itens}`
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
    qc.invalidateQueries({ queryKey: ["compras-list"] });
    qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    qc.invalidateQueries({ queryKey: ["fornecedor-compras"] });
    qc.invalidateQueries({ queryKey: ["fechamento"] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Compras"
        description="Histórico de compras por fornecedor"
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditId(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Nova compra
            </Button>
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
                <div key={c.id} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to="/fornecedores/$id"
                        params={{ id: c.fornecedor_id }}
                        className="font-medium hover:underline"
                      >
                        {c.fornecedores?.nome ?? "—"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.data_compra + "T12:00:00").toLocaleDateString("pt-BR")}
                        {" · "}
                        {c.forma_pagamento}
                        {c.numero_nf ? ` · NF ${c.numero_nf}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold">{fmtBRL(Number(c.valor_total) || 0)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {quitada ? (
                      <Badge variant="secondary">Quitada</Badge>
                    ) : (
                      <Badge variant="outline">
                        {pagas}/{total} pagas
                      </Badge>
                    )}
                    {prox && (
                      <Badge variant={vencida ? "destructive" : "outline"}>
                        Próx.{" "}
                        {new Date(prox.data_vencimento + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                        )}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditId(c.id);
                            setOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => excluirCompra(c)}
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </Button>
                      </>
                    )}
                    {prox && (
                      <Button variant="secondary" size="sm" asChild>
                        <Link
                          to="/contas-a-pagar"
                          search={{ fornecedor: c.fornecedor_id }}
                        >
                          Ver parcelas em aberto
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

          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Pagamento</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Próx. vencimento</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const { total, pagas, prox, quitada } = resumoParcelas(
                    c.compra_parcelas ?? [],
                  );
                  const vencida = prox && prox.data_vencimento < today;
                  return (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(c.data_compra + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/fornecedores/$id"
                          params={{ id: c.fornecedor_id }}
                          className="font-medium hover:underline"
                        >
                          {c.fornecedores?.nome ?? "—"}
                        </Link>
                        {c.numero_nf && (
                          <div className="text-xs text-muted-foreground">
                            NF {c.numero_nf}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {fmtBRL(Number(c.valor_total) || 0)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.forma_pagamento}
                      </td>
                      <td className="px-4 py-3">
                        {quitada ? (
                          <Badge variant="secondary">Quitada</Badge>
                        ) : (
                          <Badge variant="outline">
                            {pagas}/{total} pagas
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {prox ? (
                          <span
                            className={
                              vencida
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {new Date(
                              prox.data_vencimento + "T12:00:00",
                            ).toLocaleDateString("pt-BR")}
                            {" · "}
                            {fmtBRL(Number(prox.valor) || 0)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          {isAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditId(c.id);
                                  setOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Excluir compra"
                                onClick={() => excluirCompra(c)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
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
        onSaved={() => qc.invalidateQueries({ queryKey: ["compras-list"] })}
      />
    </div>
  );
}
