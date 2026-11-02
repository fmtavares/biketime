import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fmtBRL } from "@/lib/finance";
import { Plus, Search, Package, Trash2, Copy, ChevronDown, Bike } from "lucide-react";
import { toast } from "sonner";
import { ProdutoFormDialog } from "@/components/ProdutoFormDialog";

export const Route = createFileRoute("/_app/vendas/produtos")({
  validateSearch: (s: Record<string, unknown>) => ({
    categoria: typeof s.categoria === "string" && s.categoria.trim() ? s.categoria : undefined,
  }),
  component: ProdutosPage,
});

/** Rótulos do status da ficha da bike, exibidos no card do catálogo. */
const statusBikeLabel: Record<string, string> = {
  em_estoque: "Em estoque",
  reservada: "Reservada",
  vendida: "Vendida",
  em_montagem: "Em montagem",
  em_transito: "Em trânsito",
  consignada: "Consignada",
};

/**
 * Diz se a linha de produto é o espelho de uma bike de venda.
 * A ficha continua em bikes_estoque (bike_estoque_id).
 */
function ehBike(p: { bike_estoque_id?: string | null }) {
  return !!p.bike_estoque_id;
}

/**
 * Lê o status da bike vinculada, seja objeto ou lista (formato do embed).
 */
function statusDaBike(p: { bikes_estoque?: { status?: string } | { status?: string }[] | null }) {
  const rel = p.bikes_estoque;
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.status ?? null;
}

/**
 * Monta payload de cópia para novo cadastro (sem id/sku; estoque zera).
 * Mantém categoria, marca, preços e foto para acelerar variantes (ex.: cor).
 */
function montarDuplicata(p: any) {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    created_by: _cb,
    produto_variantes: _pv,
    tamanho_grades: _tg,
    bikes_estoque: _be,
    bike_estoque_id: _bikeId,
    ...rest
  } = p;
  const nomeBase = String(p.nome ?? "").replace(/\s*\(cópia\)\s*$/i, "").trim();
  return {
    ...rest,
    nome: nomeBase ? `${nomeBase} (cópia)` : "Produto (cópia)",
    sku: "",
    estoque_atual: 0,
    grade_id: p.grade_id ?? null,
  };
}

/**
 * Lista acessórios e bikes de venda.
 * Bike abre /vendas/$id; acessório abre o ProdutoFormDialog.
 * O vínculo é produtos.bike_estoque_id, mantido pelo trigger sync_produto_da_bike.
 */
function ProdutosPage() {
  const { categoria: categoriaSearch } = Route.useSearch();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
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
        .select("*, tamanho_grades(nome, slug), produto_variantes(id, tamanho, estoque, ativo), bikes_estoque(status)")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["produto-categorias-filtro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_categorias")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const cat = categoriaSearch ?? "";
    return produtos.filter((p: any) => {
      if (cat && (p.categoria ?? "") !== cat) return false;
      if (!s) return true;
      return `${p.nome} ${p.marca ?? ""} ${p.modelo ?? ""} ${p.categoria ?? ""} ${p.sku ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [produtos, q, categoriaSearch]);

  /**
   * Troca o filtro de categoria e mantém a URL (o atalho /vendas/estoque cai em Bikes).
   */
  function filtrarCategoria(nome: string) {
    navigate({
      to: "/vendas/produtos",
      search: { categoria: nome || undefined },
      replace: true,
    });
  }

  /**
   * Remove o acessório, ou a bike inteira quando a linha é o espelho da ficha.
   * Excluir a bike também apaga o produto (cascade no banco).
   */
  async function remove(p: { id: string; bike_estoque_id?: string | null }) {
    if (ehBike(p)) {
      if (!confirm("Excluir esta bike? A ficha e o item em Produtos serão removidos.")) return;
      const { error } = await supabase.from("bikes_estoque").delete().eq("id", p.bike_estoque_id!);
      if (error) return toast.error(error.message);
      toast.success("Bike excluída");
      qc.invalidateQueries({ queryKey: ["produtos-list"] });
      return;
    }
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", p.id);
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
            Acessórios e bikes de venda. A bike abre a ficha completa; o acessório, o cadastro do produto.
          </p>
        </div>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4" />
                Novo
                <ChevronDown className="h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  setEdit(null);
                  setDuplicando(false);
                  setOpen(true);
                }}
              >
                <Package className="h-4 w-4" />
                Novo produto
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: "/vendas/nova" })}>
                <Bike className="h-4 w-4" />
                Nova bike
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome, marca, categoria…"
            className="pl-9"
          />
        </div>
        <select
          value={categoriaSearch ?? ""}
          onChange={(e) => filtrarCategoria(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Package className="h-8 w-8 opacity-50" />
            {categoriaSearch ? `Nenhum item em ${categoriaSearch}.` : "Nenhum produto cadastrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => {
            const foto = p.fotos?.[0];
            const bike = ehBike(p);
            const statusBike = bike ? statusDaBike(p) : null;
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                  <div className="aspect-[4/3] overflow-hidden rounded-md border bg-secondary/30 sm:aspect-square">
                    {foto ? (
                      <img src={foto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {bike ? (
                          <Bike className="h-6 w-6 text-muted-foreground opacity-40" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground opacity-40" />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{p.nome}</span>
                      {p.categoria && <Badge variant="secondary">{p.categoria}</Badge>}
                      {statusBike && (
                        <Badge variant="outline">{statusBikeLabel[statusBike] ?? statusBike}</Badge>
                      )}
                      {p.visivel_ecommerce && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                          Showroom
                        </Badge>
                      )}
                      {p.grade_id && (
                        <Badge variant="outline">
                          {p.tamanho_grades?.nome ?? "Com tamanhos"}
                        </Badge>
                      )}
                      {!p.ativo && <Badge variant="outline">Inativo</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[p.marca, p.modelo, p.sku && `SKU ${p.sku}`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-2 font-semibold">{fmtBRL(Number(p.preco_venda) || 0)}</div>
                    <div className="text-xs text-muted-foreground">
                      Estoque: {Number(p.estoque_atual) || 0}
                      {p.grade_id && Array.isArray(p.produto_variantes) && (
                        <>
                          {" "}
                          (
                          {p.produto_variantes
                            .filter((v: any) => v.ativo)
                            .map((v: any) => `${v.tamanho}:${Number(v.estoque) || 0}`)
                            .join(" · ") || "sem variantes"}
                          )
                        </>
                      )}
                    </div>
                    {Number(p.valor_mercado) > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Mercado: {fmtBRL(Number(p.valor_mercado))}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {bike ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate({ to: "/vendas/$id", params: { id: p.bike_estoque_id } })}
                        >
                          Abrir ficha
                        </Button>
                      ) : (
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
                      )}
                      {!bike && (
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
                      )}
                      <Button variant="ghost" size="sm" onClick={() => remove(p)}>
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
