import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bike } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtPreco, type LojaBike } from "@/lib/loja";

export const Route = createFileRoute("/loja")({
  head: () => ({
    meta: [
      { title: "Showroom · BikeTime" },
      {
        name: "description",
        content:
          "Curadoria BikeTime: bikes selecionadas do nosso estoque. Interesse via WhatsApp.",
      },
      { property: "og:title", content: "Showroom · BikeTime" },
      { property: "og:url", content: "https://biketime.com.br/loja" },
    ],
    links: [{ rel: "canonical", href: "https://biketime.com.br/loja" }],
  }),
  component: LojaPage,
});

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "road", label: "Road" },
  { id: "triatlo", label: "Triatlo" },
  { id: "mtb", label: "MTB" },
  { id: "trail", label: "Trail" },
] as const;

type FiltroId = (typeof FILTROS)[number]["id"];

/**
 * Verifica se a bike cabe no filtro rápido (categoria + nome do modelo).
 */
function matchFiltro(bike: LojaBike, filtro: FiltroId): boolean {
  if (filtro === "todas") return true;
  const cat = (bike.categoria ?? "").toLowerCase().trim();
  const modelo = (bike.modelo ?? "").toLowerCase();
  const texto = `${cat} ${modelo}`;

  switch (filtro) {
    case "road":
      return cat === "road" || texto.includes("road");
    case "triatlo":
      return (
        cat === "triathlon" ||
        cat === "triatlo" ||
        texto.includes("triath") ||
        texto.includes("triatlo")
      );
    case "mtb":
      return cat === "mtb" || texto.includes("mtb");
    case "trail":
      return (
        cat === "trail" ||
        cat === "gravel" ||
        texto.includes("trail") ||
        texto.includes("gravel")
      );
    default:
      return true;
  }
}

/**
 * Lista pública do showroom (bikes com visivel_ecommerce).
 * Sem link na navegação — acesso por URL /loja.
 */
function LojaPage() {
  const [filtro, setFiltro] = useState<FiltroId>("todas");

  const { data: bikes = [], isLoading, isError } = useQuery({
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

  const filtradas = useMemo(
    () => bikes.filter((b) => matchFiltro(b, filtro)),
    [bikes, filtro],
  );

  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          / Showroom
        </span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Curadoria <span className="text-gradient-yellow">BikeTime</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Seleção especial do nosso estoque, fale conosco pelo WhatsApp.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  ativo
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
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
        {!isLoading && !isError && bikes.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/60 px-8 py-16 text-center">
            <Bike className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Nenhuma bike disponível no showroom no momento.
            </p>
          </div>
        )}
        {!isLoading && !isError && bikes.length > 0 && filtradas.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/60 px-8 py-16 text-center">
            <p className="text-muted-foreground">
              Nenhuma bike nesta categoria. Tente outro filtro.
            </p>
          </div>
        )}
        {filtradas.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((b) => (
              <BikeCard key={b.id} bike={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Card do showroom com foto, nome e preço. */
function BikeCard({ bike }: { bike: LojaBike }) {
  const nome = `${bike.marca} ${bike.modelo}`;
  return (
    <Link
      to="/loja/$id"
      params={{ id: bike.id }}
      className="hover-lift group block overflow-hidden rounded-2xl border border-border bg-surface/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold leading-tight">{nome}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {[bike.ano, bike.tamanho && `Tam ${bike.tamanho}`, bike.condicao]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-4 font-display text-lg font-bold text-primary">
          {fmtPreco(bike.valor_proposto)}
        </div>
      </div>
    </Link>
  );
}
