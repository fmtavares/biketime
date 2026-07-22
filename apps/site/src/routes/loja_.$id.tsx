import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bike, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtPreco, whatsappInteresse, type LojaBike } from "@/lib/loja";

export const Route = createFileRoute("/loja_/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Bike · Showroom BikeTime` },
      { property: "og:url", content: `https://biketime.com.br/loja/${params.id}` },
    ],
  }),
  component: LojaDetalhePage,
});

/**
 * Detalhe de uma bike do showroom + CTA WhatsApp (sem pagamento).
 */
function LojaDetalhePage() {
  const { id } = Route.useParams();

  const { data: bike, isLoading, isError } = useQuery({
    queryKey: ["loja-bike", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_bikes")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as LojaBike | null;
    },
  });

  if (isLoading) {
    return (
      <div className="container-px mx-auto max-w-7xl py-20 text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (isError || !bike) {
    return (
      <div className="container-px mx-auto max-w-7xl py-20">
        <Link
          to="/loja"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Voltar ao showroom
        </Link>
        <p className="mt-8 text-muted-foreground">Bike não encontrada no showroom.</p>
      </div>
    );
  }

  const nome = `${bike.marca} ${bike.modelo}`;
  const wa = whatsappInteresse(bike);

  return (
    <div className="container-px mx-auto max-w-7xl py-12 md:py-20">
      <Link
        to="/loja"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Showroom
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
          <div className="relative aspect-[4/3] bg-secondary/40">
            {bike.foto_completa ? (
              <img
                src={bike.foto_completa}
                alt={nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Bike className="h-16 w-16 opacity-40" />
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            / Showroom
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{nome}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {[
              bike.ano && String(bike.ano),
              bike.tamanho && `Tamanho ${bike.tamanho}`,
              bike.cor,
              bike.categoria,
              bike.condicao,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-8 font-display text-3xl font-bold text-primary">
            {fmtPreco(bike.valor_proposto)}
          </div>

          {bike.observacoes_tecnicas && (
            <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {bike.observacoes_tecnicas}
            </div>
          )}

          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <MessageCircle size={18} />
            Tenho interesse no WhatsApp
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem pagamento online. Conversamos pelo WhatsApp sobre disponibilidade e retirada.
          </p>
        </div>
      </div>
    </div>
  );
}
