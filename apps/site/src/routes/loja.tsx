import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bike, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fmtPreco,
  fotoProduto,
  etiquetaCondicao,
  type LojaBike,
  type LojaProduto,
} from "@/lib/loja";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Showroom · BikeTime" },
      {
        name: "description",
        content:
          "Bikes e acessórios cuidadosamente selecionados. Não encontrou o que procura? Nossa equipe localiza e negocia a melhor opção para você.",
      },
      { property: "og:title", content: "Showroom · BikeTime" },
      { property: "og:url", content: "https://biketime.com.br/loja" },
    ],
    links: [{ rel: "canonical", href: "https://biketime.com.br/loja" }],
  }),
  component: LojaPage,
});

type FiltroPrincipal = "todas" | "bikes" | `prod:${string}`;
/** Subfiltro de bike: todas ou slug da categoria cadastrada (ex.: eletrica, road). */
type SubBike = "todas" | string;

type ItemShowroom =
  | { kind: "bike"; data: LojaBike }
  | { kind: "produto"; data: LojaProduto };

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
 * Slug da categoria da bike (vazio se não houver).
 */
function slugBike(bike: LojaBike): string {
  return slugCategoria(bike.categoria ?? "");
}

/**
 * Estilo dos chips do menu principal (Todas / Bikes / Capacetes…).
 */
function chipClass(ativo: boolean) {
  return `rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
    ativo
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-surface/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
  }`;
}

/**
 * Estilo dos subfiltros de bike no desktop (mais discretos que o menu principal).
 */
function subChipClass(ativo: boolean) {
  return `shrink-0 whitespace-nowrap border-b-2 px-3 py-1.5 text-sm font-medium transition-colors ${
    ativo
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`;
}

/**
 * Subfiltro de tipo de bike: select no mobile, chips em scroll no desktop.
 */
function SubfiltroBike({
  opcoes,
  value,
  onChange,
}: {
  opcoes: { id: string; label: string }[];
  value: SubBike;
  onChange: (v: SubBike) => void;
}) {
  return (
    <>
      {/* Mobile: um único select — evita segunda fileira de pills */}
      <div className="mt-4 md:hidden">
        <label htmlFor="subfiltro-bike" className="sr-only">
          Tipo de bike
        </label>
        <select
          id="subfiltro-bike"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-surface/60 px-3 text-sm font-semibold text-foreground"
        >
          <option value="todas">Todas</option>
          {opcoes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop: chips finos em scroll horizontal */}
      <div className="relative mt-4 hidden md:block">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
        <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => onChange("todas")}
            className={subChipClass(value === "todas")}
          >
            Todas
          </button>
          {opcoes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={subChipClass(value === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/**
 * Lista pública do showroom (bikes + produtos com visivel_ecommerce).
 * Menu dinâmico: o que estiver cadastrado aparece; em Bikes, subfiltro por tipo.
 */
function LojaPage() {
  const [principal, setPrincipal] = useState<FiltroPrincipal>("todas");
  const [subBike, setSubBike] = useState<SubBike>("todas");

  const { data: bikes = [], isLoading: loadingBikes, isError: errBikes } = useQuery({
    queryKey: ["loja-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_bikes")
        .select("*")
        .order("marca")
        .order("modelo");
      if (error) throw error;
      return (data ?? []) as LojaBike[];
    },
  });

  const {
    data: produtos = [],
    isLoading: loadingProdutos,
    isError: errProdutos,
  } = useQuery({
    queryKey: ["loja-produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as LojaProduto[];
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

  /**
   * Subfiltros de bike dinâmicos: categorias presentes no catálogo publicado
   * (Road, Elétrica, MTB, etc. — o que estiver cadastrado).
   */
  const subfiltrosBike = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bikes) {
      const nome = (b.categoria ?? "").trim();
      if (!nome) continue;
      const slug = slugCategoria(nome);
      if (slug && !map.has(slug)) map.set(slug, nome);
    }
    return Array.from(map.entries())
      .map(([slug, nome]) => ({ id: slug, label: nome }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [bikes]);

  /** Menu principal: Todas + Bikes (se houver) + categorias de produto. */
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

  const isLoading = loadingBikes || loadingProdutos;
  const isError = errBikes || errProdutos;

  const itens = useMemo(() => {
    const list: ItemShowroom[] = [];

    if (principal === "todas") {
      for (const b of bikes) list.push({ kind: "bike", data: b });
      for (const p of produtos) list.push({ kind: "produto", data: p });
      return list;
    }

    if (principal === "bikes") {
      for (const b of bikes) {
        if (subBike === "todas" || slugBike(b) === subBike) {
          list.push({ kind: "bike", data: b });
        }
      }
      return list;
    }

    // Categoria de produto
    const slug = principal.slice("prod:".length);
    for (const p of produtos) {
      if ((p.categoria_slug ?? "") === slug) {
        list.push({ kind: "produto", data: p });
      }
    }
    return list;
  }, [bikes, produtos, principal, subBike]);

  const total = bikes.length + produtos.length;
  const mostrandoBikes = principal === "bikes";

  /**
   * Troca o filtro principal; ao entrar em Bikes, reseta o subfiltro.
   */
  function onPrincipal(id: FiltroPrincipal) {
    setPrincipal(id);
    if (id === "bikes") setSubBike("todas");
  }

  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          / Showroom
        </span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Curadoria <span className="text-gradient-yellow">BikeTime</span>.
        </h1>
        <p className="mt-5 max-w-4xl text-lg text-muted-foreground md:max-w-5xl">
          Bikes e acessórios cuidadosamente selecionados. Não encontrou o que procura?
          Nossa equipe localiza e negocia a melhor opção para você.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {filtrosPrincipais.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onPrincipal(f.id)}
              className={chipClass(principal === f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {mostrandoBikes && subfiltrosBike.length > 0 && (
          <SubfiltroBike
            opcoes={subfiltrosBike}
            value={subBike}
            onChange={setSubBike}
          />
        )}
      </section>

      <section className="container-px mx-auto max-w-7xl pb-24">
        {isLoading && (
          <p className="text-muted-foreground">Carregando showroom…</p>
        )}
        {isError && (
          <p className="text-muted-foreground">
            Não foi possível carregar o catálogo. Tente novamente em instantes.
          </p>
        )}
        {!isLoading && !isError && total === 0 && (
          <div className="rounded-2xl border border-border bg-surface/60 px-8 py-16 text-center">
            <Bike className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Nenhum item disponível no showroom no momento.
            </p>
          </div>
        )}
        {!isLoading && !isError && total > 0 && itens.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/60 px-8 py-16 text-center">
            <p className="text-muted-foreground">
              Nenhum item nesta categoria. Tente outro filtro.
            </p>
          </div>
        )}
        {itens.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {itens.map((item) =>
              item.kind === "bike" ? (
                <BikeCard key={`bike-${item.data.id}`} bike={item.data} />
              ) : (
                <ProdutoCard key={`prod-${item.data.id}`} produto={item.data} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Etiqueta sobre a foto para seminova/usado. */
function EtiquetaCondicao({ condicao }: { condicao: string | null | undefined }) {
  const label = etiquetaCondicao(condicao);
  if (!label) return null;
  return (
    <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
      {label}
    </span>
  );
}

/** Card do showroom com foto, nome e preço da bike. */
function BikeCard({ bike }: { bike: LojaBike }) {
  const nome = `${bike.marca} ${bike.modelo}`;
  return (
    <Link
      to="/loja/$id"
      params={{ id: bike.id }}
      className="hover-lift group block overflow-hidden rounded-2xl border border-border bg-surface/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        <EtiquetaCondicao condicao={bike.condicao} />
        {bike.foto_completa ? (
          <img
            src={bike.foto_completa}
            alt={nome}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Bike className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold leading-tight">{nome}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {[bike.ano, bike.tamanho && `Tam ${bike.tamanho}`, bike.condicao]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="mt-4 font-display text-lg font-bold text-primary">
          {fmtPreco(bike.valor_proposto)}
        </div>
      </div>
    </Link>
  );
}

/** Card do showroom para produto/acessório. */
function ProdutoCard({ produto }: { produto: LojaProduto }) {
  const foto = fotoProduto(produto);
  const nome = produto.nome;
  return (
    <Link
      to="/loja/produto/$id"
      params={{ id: produto.id }}
      className="hover-lift group block overflow-hidden rounded-2xl border border-border bg-surface/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
        {foto ? (
          <img
            src={foto}
            alt={nome}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="h-10 w-10 opacity-40" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold leading-tight">{nome}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {[produto.categoria, produto.marca, produto.modelo].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="mt-4 font-display text-lg font-bold text-primary">
          {fmtPreco(produto.preco_venda)}
        </div>
      </div>
    </Link>
  );
}
