import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { CompraFormDialog } from "@/components/CompraFormDialog";
import { fmtBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/contas-a-pagar")({
  validateSearch: (s: Record<string, unknown>) => ({
    fornecedor: typeof s.fornecedor === "string" ? s.fornecedor : undefined,
  }),
  component: ContasAPagarPage,
});

type FiltroChip = "abertas" | "vencidas";

type ParcelaRow = {
  id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  status: string;
  compra_id: string;
  data_compra: string;
  numero_nf: string | null;
  forma_pagamento: string;
  fornecedor_id: string;
  fornecedor_nome: string;
};

/**
 * Lista operacional de parcelas em aberto (A Pagar).
 */
function ContasAPagarPage() {
  const { fornecedor: fornecedorSearch } = Route.useSearch();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filtroForn, setFiltroForn] = useState(fornecedorSearch ?? "");
  const [filtroChip, setFiltroChip] = useState<FiltroChip>("abertas");
  const [editCompraId, setEditCompraId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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

  const { data: parcelas = [], isLoading } = useQuery({
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

      return (data ?? []).map((p: any): ParcelaRow => {
        const compra = p.compras;
        return {
          id: p.id,
          numero: p.numero,
          valor: Number(p.valor) || 0,
          data_vencimento: p.data_vencimento,
          status: p.status,
          compra_id: p.compra_id,
          data_compra: compra?.data_compra ?? "",
          numero_nf: compra?.numero_nf ?? null,
          forma_pagamento: compra?.forma_pagamento ?? "",
          fornecedor_id: compra?.fornecedor_id ?? "",
          fornecedor_nome: compra?.fornecedores?.nome ?? "—",
        };
      });
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    return parcelas.filter((p) => {
      if (filtroForn && p.fornecedor_id !== filtroForn) return false;
      if (filtroChip === "vencidas" && p.data_vencimento >= today) return false;

      const s = q.toLowerCase().trim();
      if (!s) return true;
      return `${p.fornecedor_nome} ${p.numero_nf ?? ""} ${p.forma_pagamento}`
        .toLowerCase()
        .includes(s);
    });
  }, [parcelas, filtroForn, filtroChip, q, today]);

  const totais = useMemo(() => {
    let emAberto = 0;
    let vencido = 0;
    for (const p of filtered) {
      emAberto += p.valor;
      if (p.data_vencimento < today) vencido += p.valor;
    }
    return { emAberto, vencido };
  }, [filtered, today]);

  /**
   * Marca parcela como paga e atualiza as listas.
   */
  async function marcarPaga(parcelaId: string) {
    if (!isAdmin) return toast.error("Somente administradores");
    const { error } = await supabase
      .from("compra_parcelas")
      .update({ status: "paga", data_pagamento: new Date().toISOString() })
      .eq("id", parcelaId);
    if (error) return toast.error(error.message);
    toast.success("Parcela marcada como paga");
    qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    qc.invalidateQueries({ queryKey: ["compras-list"] });
    qc.invalidateQueries({ queryKey: ["fornecedor-compras"] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="A Pagar"
        description="Parcelas em aberto por vencimento"
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Em aberto
          </div>
          <div className="mt-1 text-2xl font-display font-bold">
            {fmtBRL(totais.emAberto)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Vencido
          </div>
          <div className="mt-1 text-2xl font-display font-bold text-destructive">
            {fmtBRL(totais.vencido)}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="max-w-md flex-1">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Buscar fornecedor, NF…"
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
            {filtered.map((p) => {
              const vencida = p.data_vencimento < today;
              return (
                <div key={p.id} className="rounded-xl border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to="/fornecedores/$id"
                        params={{ id: p.fornecedor_id }}
                        className="font-medium hover:underline"
                      >
                        {p.fornecedor_nome}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Parcela #{p.numero}
                        {" · "}
                        {p.forma_pagamento}
                        {p.numero_nf ? ` · NF ${p.numero_nf}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold">{fmtBRL(p.valor)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={vencida ? "destructive" : "outline"}>
                      Venc.{" "}
                      {new Date(p.data_vencimento + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                      )}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => marcarPaga(p.id)}
                        >
                          <Check className="size-3.5" /> Marcar paga
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditCompraId(p.compra_id);
                            setOpen(true);
                          }}
                        >
                          Editar compra
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl">
                Nenhuma parcela em aberto.
              </div>
            )}
          </div>

          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3">Compra</th>
                  <th className="text-left px-4 py-3">Parcela</th>
                  <th className="text-left px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Pagamento</th>
                  {isAdmin && <th className="text-right px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const vencida = p.data_vencimento < today;
                  return (
                    <tr
                      key={p.id}
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
                            p.data_vencimento + "T12:00:00",
                          ).toLocaleDateString("pt-BR")}
                        </span>
                        {vencida && (
                          <Badge variant="destructive" className="ml-2">
                            Vencida
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to="/fornecedores/$id"
                          params={{ id: p.fornecedor_id }}
                          className="font-medium hover:underline"
                        >
                          {p.fornecedor_nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.data_compra
                          ? new Date(p.data_compra + "T12:00:00").toLocaleDateString(
                              "pt-BR",
                            )
                          : "—"}
                        {p.numero_nf ? ` · NF ${p.numero_nf}` : ""}
                      </td>
                      <td className="px-4 py-3">#{p.numero}</td>
                      <td className="px-4 py-3 font-semibold">{fmtBRL(p.valor)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.forma_pagamento}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button size="sm" onClick={() => marcarPaga(p.id)}>
                              <Check className="size-3.5" /> Pagar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditCompraId(p.compra_id);
                                setOpen(true);
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
                      colSpan={isAdmin ? 7 : 6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Nenhuma parcela em aberto.
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
        compraId={editCompraId}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
          qc.invalidateQueries({ queryKey: ["compras-list"] });
        }}
      />
    </div>
  );
}
