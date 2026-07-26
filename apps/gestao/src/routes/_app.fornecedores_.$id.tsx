import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Plus, Check, Phone, Mail, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FornecedorFormDialog } from "@/components/FornecedorFormDialog";
import { CompraFormDialog } from "@/components/CompraFormDialog";
import { formatCnpj, formatPhoneBr } from "@/lib/utils";
import { fmtBRL } from "@/lib/finance";
import { agoraComoPagamentoISO } from "@/lib/datas";

export const Route = createFileRoute("/_app/fornecedores_/$id")({
  component: FornecedorDetail,
});

/**
 * Detalhe do fornecedor: dados + compras e resumo de parcelas em aberto.
 */
function FornecedorDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [compraOpen, setCompraOpen] = useState(false);
  const [editCompraId, setEditCompraId] = useState<string | null>(null);

  const { data: fornecedor, refetch } = useQuery({
    queryKey: ["fornecedor", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: compras = [], refetch: refetchCompras } = useQuery({
    queryKey: ["fornecedor-compras", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select(
          "*, compra_parcelas(id, numero, valor, data_vencimento, status, data_pagamento), compra_itens(id, descricao, quantidade, valor)",
        )
        .eq("fornecedor_id", id)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const resumo = useMemo(() => {
    let emAberto = 0;
    let proxVenc: string | null = null;
    for (const c of compras as any[]) {
      for (const p of c.compra_parcelas ?? []) {
        if (p.status !== "aberta") continue;
        emAberto += Number(p.valor) || 0;
        if (!proxVenc || p.data_vencimento < proxVenc) proxVenc = p.data_vencimento;
      }
    }
    return { emAberto, proxVenc };
  }, [compras]);

  /**
   * Marca parcela como paga e atualiza listas.
   */
  async function marcarPaga(parcelaId: string) {
    if (!isAdmin) return toast.error("Somente administradores");
    const { error } = await supabase
      .from("compra_parcelas")
      .update({ status: "paga", data_pagamento: agoraComoPagamentoISO() })
      .eq("id", parcelaId);
    if (error) return toast.error(error.message);
    toast.success("Parcela marcada como paga");
    refetchCompras();
    qc.invalidateQueries({ queryKey: ["compras-list"] });
  }

  /**
   * Exclui compra do fornecedor (itens e parcelas em cascata).
   */
  async function excluirCompra(c: any) {
    if (!isAdmin) return toast.error("Somente administradores");
    const nf = c.numero_nf ? ` NF ${c.numero_nf}` : "";
    if (
      !confirm(
        `Excluir a compra${nf}?\nItens e parcelas também serão removidos.`,
      )
    ) {
      return;
    }
    const { error } = await supabase.from("compras").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Compra excluída");
    refetchCompras();
    qc.invalidateQueries({ queryKey: ["compras-list"] });
    qc.invalidateQueries({ queryKey: ["contas-a-pagar"] });
    qc.invalidateQueries({ queryKey: ["fechamento"] });
  }

  if (!fornecedor) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/fornecedores"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="size-3.5" /> Fornecedores
          </Link>
          <h1 className="text-xl sm:text-2xl font-display font-bold flex flex-wrap items-center gap-2">
            {fornecedor.nome}
            {fornecedor.ativo ? (
              <Badge variant="secondary">Ativo</Badge>
            ) : (
              <Badge variant="outline">Inativo</Badge>
            )}
          </h1>
          {fornecedor.nome_fantasia && (
            <p className="text-sm text-muted-foreground">{fornecedor.nome_fantasia}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="size-4" /> Editar
            </Button>
            <Button
              onClick={() => {
                setEditCompraId(null);
                setCompraOpen(true);
              }}
            >
              <Plus className="size-4" /> Nova compra
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        {fornecedor.cnpj && (
          <div className="rounded-xl border bg-card p-3">
            <div className="text-xs text-muted-foreground">CNPJ</div>
            <div>{formatCnpj(fornecedor.cnpj)}</div>
          </div>
        )}
        {fornecedor.telefone && (
          <div className="rounded-xl border bg-card p-3 flex items-start gap-2">
            <Phone className="size-3.5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Telefone</div>
              <div>{formatPhoneBr(fornecedor.telefone)}</div>
            </div>
          </div>
        )}
        {fornecedor.email && (
          <div className="rounded-xl border bg-card p-3 flex items-start gap-2">
            <Mail className="size-3.5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">E-mail</div>
              <div className="truncate">{fornecedor.email}</div>
            </div>
          </div>
        )}
        {(fornecedor.cidade || fornecedor.estado) && (
          <div className="rounded-xl border bg-card p-3 flex items-start gap-2">
            <MapPin className="size-3.5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Cidade</div>
              <div>
                {[fornecedor.cidade, fornecedor.estado].filter(Boolean).join("/")}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Em aberto
          </div>
          <div className="mt-1 text-2xl font-display font-bold">
            {fmtBRL(resumo.emAberto)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Próximo vencimento
          </div>
          <div className="mt-1 text-2xl font-display font-bold">
            {resumo.proxVenc
              ? new Date(resumo.proxVenc + "T12:00:00").toLocaleDateString("pt-BR")
              : "—"}
          </div>
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-display font-bold text-lg">Compras</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/compras"
              search={{ fornecedor: id }}
              className="text-xs text-muted-foreground hover:underline"
            >
              Ver na lista global
            </Link>
            <Link
              to="/contas-a-pagar"
              search={{ fornecedor: id }}
              className="text-xs text-muted-foreground hover:underline"
            >
              A Pagar deste fornecedor
            </Link>
          </div>
        </div>

        {compras.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl">
            Nenhuma compra registrada para este fornecedor.
          </div>
        ) : (
          <div className="space-y-3">
            {(compras as any[]).map((c) => {
              const pars = [...(c.compra_parcelas ?? [])].sort(
                (a: any, b: any) => a.numero - b.numero,
              );
              const pagas = pars.filter((p: any) => p.status === "paga").length;
              return (
                <div key={c.id} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {new Date(c.data_compra + "T12:00:00").toLocaleDateString("pt-BR")}
                        {" · "}
                        {fmtBRL(Number(c.valor_total) || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.forma_pagamento}
                        {c.numero_nf ? ` · NF ${c.numero_nf}` : ""}
                        {" · "}
                        {pagas}/{pars.length} pagas
                      </div>
                      {(c.compra_itens ?? []).length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {(c.compra_itens as any[])
                            .map((i) => i.descricao)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditCompraId(c.id);
                            setCompraOpen(true);
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
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {pars.map((p: any) => {
                      const vencida =
                        p.status === "aberta" && p.data_vencimento < today;
                      return (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm border-t pt-1.5"
                        >
                          <div>
                            <span className="text-muted-foreground">#{p.numero}</span>
                            {" · "}
                            <span className={vencida ? "text-destructive font-medium" : ""}>
                              {new Date(p.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                            {" · "}
                            {fmtBRL(Number(p.valor) || 0)}
                          </div>
                          <div className="flex items-center gap-2">
                            {p.status === "paga" ? (
                              <Badge variant="secondary">Paga</Badge>
                            ) : (
                              <>
                                <Badge variant={vencida ? "destructive" : "outline"}>
                                  Aberta
                                </Badge>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => marcarPaga(p.id)}
                                  >
                                    <Check className="size-3.5" /> Pagar
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <FornecedorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        fornecedor={fornecedor}
        onSaved={() => refetch()}
      />
      <CompraFormDialog
        open={compraOpen}
        onOpenChange={setCompraOpen}
        compraId={editCompraId}
        defaultFornecedorId={id}
        fornecedorLocked
        onSaved={() => {
          refetchCompras();
          qc.invalidateQueries({ queryKey: ["compras-list"] });
        }}
      />
    </div>
  );
}
