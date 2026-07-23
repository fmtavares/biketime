import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBRL } from "@/lib/finance";
import { Plus, Search, Package, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { ProdutoFormDialog } from "@/components/ProdutoFormDialog";

export const Route = createFileRoute("/_app/vendas/produtos")({
  component: ProdutosPage,
});

/**
 * Monta payload de cópia para novo cadastro (sem id/sku; estoque zera).
 * Mantém categoria, marca, preços e foto para acelerar variantes (ex.: cor).
 */
function montarDuplicata(p: any) {
  const { id: _id, created_at: _c, updated_at: _u, created_by: _cb, ...rest } = p;
  const nomeBase = String(p.nome ?? "").replace(/\s*\(cópia\)\s*$/i, "").trim();
  return {
    ...rest,
    nome: nomeBase ? `${nomeBase} (cópia)` : "Produto (cópia)",
    sku: "",
    estoque_atual: 0,
  };
}

/**
 * Lista e gerencia produtos/acessórios (capacetes, óculos, etc.) para o showroom.
 */
function ProdutosPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [duplicando, setDuplicando] = useState(false);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return produtos;
    return produtos.filter((p: any) =>
      `${p.nome} ${p.marca ?? ""} ${p.modelo ?? ""} ${p.categoria ?? ""} ${p.sku ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [produtos, q]);

  async function remove(id: string) {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["produtos-list"] });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Capacetes, óculos, sapatilhas e outros — marque “Visível no showroom” para publicar em /loja
          </p>
        </div>
        {isAdmin && (
          <Button
            size="lg"
            onClick={() => {
              setEdit(null);
              setDuplicando(false);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </Button>
        )}
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nome, marca, categoria…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Package className="h-8 w-8 opacity-50" />
            Nenhum produto cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => {
            const foto = p.fotos?.[0];
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                  <div className="aspect-[4/3] overflow-hidden rounded-md border bg-secondary/30 sm:aspect-square">
                    {foto ? (
                      <img src={foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.nome}</span>
                      {p.categoria && <Badge variant="secondary">{p.categoria}</Badge>}
                      {p.visivel_ecommerce && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                          Showroom
                        </Badge>
                      )}
                      {!p.ativo && <Badge variant="outline">Inativo</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[p.marca, p.modelo, p.sku && `SKU ${p.sku}`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-2 font-semibold">{fmtBRL(Number(p.preco_venda) || 0)}</div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEdit(p);
                          setDuplicando(false);
                          setOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Criar novo produto a partir deste"
                        onClick={() => {
                          setEdit(montarDuplicata(p));
                          setDuplicando(true);
                          setOpen(true);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProdutoFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setDuplicando(false);
        }}
        produto={edit}
        duplicata={duplicando}
        onSaved={() => qc.invalidateQueries({ queryKey: ["produtos-list"] })}
      />
    </div>
  );
}
