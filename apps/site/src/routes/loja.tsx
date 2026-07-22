import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

/**
 * Lista pública do showroom (bikes com visivel_ecommerce).
 * Sem link na navegação — acesso por URL /loja.
 */
function LojaPage() {
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
        {bikes.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bikes.map((b) => (
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
