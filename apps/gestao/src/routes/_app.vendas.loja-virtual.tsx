import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bike, ExternalLink, Package, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBRL } from "@/lib/finance";

export const Route = createFileRoute("/_app/vendas/loja-virtual")({
  component: LojaVirtualPage,
});

const SITE_LOJA_URL = "https://biketime.com.br/loja";

type FiltroPrincipal = "todas" | "bikes" | `prod:${string}`;

type BikeShowroom = {
  id: string;
  marca: string;
  modelo: string;
  ano: number | null;
  tamanho: string | null;
  categoria: string | null;
  condicao: string | null;
  valor_proposto: number | null;
  foto_completa: string | null;
};

type ProdutoShowroom = {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  categoria: string | null;
  categoria_slug: string | null;
  preco_venda: number;
  fotos: string[] | null;
};

type ItemShowroom =
  | { kind: "bike"; data: BikeShowroom }
  | { kind: "produto"; data: ProdutoShowroom };

/**
 * Gera slug estável para comparar categorias (ex.: "Elétrica" → "eletrica").
 */
function slugCategoria(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Estilo dos chips de filtro (Tudo / Bikes / categorias).
 */
function chipClass(ativo: boolean) {
  return `rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
  }`;
}

/**
 * Página administrativa com o espelho do showroom público (/loja):
 * bikes em estoque com e-commerce + produtos ativos visíveis.
 */
function LojaVirtualPage() {
  const [principal, setPrincipal] = useState<FiltroPrincipal>("todas");

  const { data: bikes = [], isLoading: loadingBikes, isError: errBikes } = useQuery({
    queryKey: ["loja-virtual-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bikes_estoque")
        .select(
          "id, marca, modelo, ano, tamanho, categoria, condicao, valor_proposto, foto_completa",
        )
        .eq("visivel_ecommerce", true)
        .eq("status", "em_estoque")
        .order("marca")
        .order("modelo");
      if (error) throw error;
      return (data ?? []) as BikeShowroom[];
    },
  });

  const {
    data: produtos = [],
    isLoading: loadingProdutos,
    isError: errProdutos,
  } = useQuery({
    queryKey: ["loja-virtual-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(
          `
          id, nome, modelo, preco_venda, fotos, categoria, marca,
          produto_categorias ( nome, slug ),
          produto_marcas ( nome )
        `,
        )
        .eq("ativo", true)
        .eq("visivel_ecommerce", true)
        .order("nome");
      if (error) throw error;

      return (data ?? []).map((p: any): ProdutoShowroom => {
        const catNome = p.produto_categorias?.nome ?? p.categoria ?? null;
        const catSlug =
          p.produto_categorias?.slug ?? (catNome ? slugCategoria(catNome) : null);
        return {
          id: p.id,
          nome: p.nome,
          marca: p.produto_marcas?.nome ?? p.marca ?? null,
          modelo: p.modelo ?? null,
          categoria: catNome,
          categoria_slug: catSlug,
          preco_venda: Number(p.preco_venda) || 0,
          fotos: p.fotos ?? null,
        };
      });
    },
  });

  /** Categorias de produto presentes no catálogo publicado. */
  const categoriasProduto = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of produtos) {
      if (p.categoria_slug && p.categoria) {
        map.set(p.categoria_slug, p.categoria);
      }
    }
    return Array.from(map.entries())
      .map(([slug, nome]) => ({ slug, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [produtos]);

  /** Menu de filtros: Tudo + Bikes (se houver) + categorias de produto. */
  const filtrosPrincipais = useMemo(() => {
    const items: { id: FiltroPrincipal; label: string }[] = [
      { id: "todas", label: "Tudo" },
    ];
    if (bikes.length > 0) {
      items.push({ id: "bikes", label: "Bikes" });
    }
    for (const c of categoriasProduto) {
      items.push({ id: `prod:${c.slug}`, label: c.nome });
    }
    return items;
  }, [bikes.length, categoriasProduto]);

  /** Itens filtrados conforme o chip selecionado. */
  const itens = useMemo(() => {
    const list: ItemShowroom[] = [];

    if (principal === "todas") {
      for (const b of bikes) list.push({ kind: "bike", data: b });
      for (const p of produtos) list.push({ kind: "produto", data: p });
      return list;
    }

    if (principal === "bikes") {
      for (const b of bikes) list.push({ kind: "bike", data: b });
      return list;
    }

    const slug = principal.slice("prod:".length);
    for (const p of produtos) {
      if ((p.categoria_slug ?? "") === slug) {
        list.push({ kind: "produto", data: p });
      }
    }
    return list;
  }, [bikes, produtos, principal]);

  const isLoading = loadingBikes || loadingProdutos;
  const isError = errBikes || errProdutos;
  const total = bikes.length + produtos.length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Loja Virtual</h1>
          <p className="text-sm text-muted-foreground">
            Itens publicados no showroom do site ({total} no ar)
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          <a href={SITE_LOJA_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Ver no site
          </a>
        </Button>
      </header>

      {filtrosPrincipais.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {filtrosPrincipais.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPrincipal(f.id)}
              className={chipClass(principal === f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando showroom…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          Não foi possível carregar os itens da loja virtual.
        </p>
      )}

      {!isLoading && !isError && total === 0 && (
        <div className="rounded-xl border bg-card px-8 py-16 text-center text-muted-foreground">
          <Store className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3">Nenhum item publicado no showroom.</p>
          <p className="mt-1 text-xs">
            Marque “Visível no showroom” em bikes (em estoque) ou produtos ativos.
          </p>
        </div>
      )}

      {!isLoading && !isError && total > 0 && itens.length === 0 && (
        <div className="rounded-xl border bg-card px-8 py-12 text-center text-muted-foreground">
          Nenhum item neste filtro.
        </div>
      )}

      {itens.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) =>
            item.kind === "bike" ? (
              <BikeCard key={`bike-${item.data.id}`} bike={item.data} />
            ) : (
              <ProdutoCard key={`prod-${item.data.id}`} produto={item.data} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Card de bike publicada no showroom, com atalho para o cadastro na gestão.
 */
function BikeCard({ bike }: { bike: BikeShowroom }) {
  const nome = `${bike.marca} ${bike.modelo}`.trim();
  return (
    <Link
      to="/vendas/$id"
      params={{ id: bike.id }}
      className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-secondary/30">
        {bike.foto_completa ? (
          <img
            src={bike.foto_completa}
            alt={nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Bike className="h-8 w-8 opacity-40" />
          </div>
        )}
        <Badge className="absolute left-2 top-2">Bike</Badge>
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-semibold leading-tight group-hover:text-primary">{nome}</h2>
        <p className="text-xs text-muted-foreground">
          {[bike.categoria, bike.ano, bike.tamanho && `Tam ${bike.tamanho}`, bike.condicao]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="pt-1 font-semibold">{fmtBRL(Number(bike.valor_proposto) || 0)}</p>
      </div>
    </Link>
  );
}

/**
 * Card de produto/acessório publicado no showroom.
 */
function ProdutoCard({ produto }: { produto: ProdutoShowroom }) {
  const foto = produto.fotos?.[0] ?? null;
  return (
    <Link
      to="/vendas/produtos"
      className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-secondary/30">
        {foto ? (
          <img
            src={foto}
            alt={produto.nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
          </div>
        )}
        <Badge variant="secondary" className="absolute left-2 top-2">
          {produto.categoria || "Produto"}
        </Badge>
      </div>
      <div className="space-y-1 p-4">
        <h2 className="font-semibold leading-tight group-hover:text-primary">{produto.nome}</h2>
        <p className="text-xs text-muted-foreground">
          {[produto.marca, produto.modelo].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="pt-1 font-semibold">{fmtBRL(produto.preco_venda)}</p>
      </div>
    </Link>
  );
}
