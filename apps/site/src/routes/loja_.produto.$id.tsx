import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PrecoShowroom } from "@/components/preco-showroom";
import { CompartilharShowroom } from "@/components/compartilhar-showroom";
import {
  fotoProduto,
  whatsappInteresseProduto,
  tituloCompartilharProduto,
  descricaoCompartilharProduto,
  textoCompartilharProduto,
  urlShowroomProduto,
  metaTagsShowroom,
  type LojaProduto,
} from "@/lib/loja";

export const Route = createFileRoute("/loja_/produto/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("loja_produtos")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;
    return { produto: (data as LojaProduto | null) ?? null };
  },
  head: ({ loaderData, params }) => {
    const produto = loaderData?.produto;
    if (!produto) {
      return {
        meta: [
          { title: "Produto · Showroom BikeTime" },
          { property: "og:url", content: urlShowroomProduto(params.id) },
        ],
      };
    }
    return {
      meta: metaTagsShowroom({
        title: tituloCompartilharProduto(produto),
        description: descricaoCompartilharProduto(produto),
        url: urlShowroomProduto(produto.id),
        image: fotoProduto(produto),
      }),
      links: [{ rel: "canonical", href: urlShowroomProduto(produto.id) }],
    };
  },
  component: LojaProdutoDetalhePage,
});

/**
 * Detalhe de um produto/acessório do showroom + CTA WhatsApp e compartilhar.
 */
function LojaProdutoDetalhePage() {
  const { produto } = Route.useLoaderData();

  if (!produto) {
    return (
      <div className="container-px mx-auto max-w-7xl py-20">
        <Link
          to="/loja"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Voltar ao showroom
        </Link>
        <p className="mt-8 text-muted-foreground">Produto não encontrado no showroom.</p>
      </div>
    );
  }

  const foto = fotoProduto(produto);
  const wa = whatsappInteresseProduto(produto);
  const nome = tituloCompartilharProduto(produto);

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
            {foto ? (
              <img
                src={foto}
                alt={produto.nome}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Package className="h-16 w-16 opacity-40" />
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            / Showroom
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
            {produto.nome}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {[produto.categoria, produto.marca, produto.modelo].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-8">
            <PrecoShowroom
              valorMercado={produto.valor_mercado}
              valorPromocional={produto.preco_venda}
              size="detalhe"
            />
          </div>

          {produto.descricao && (
            <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {produto.descricao}
            </div>
          )}

          {produto.observacoes && (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {produto.observacoes}
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <MessageCircle size={18} />
              Tenho interesse no WhatsApp
            </a>
            <CompartilharShowroom
              title={`${nome} · Showroom BikeTime`}
              text={textoCompartilharProduto(produto)}
              url={urlShowroomProduto(produto.id)}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem pagamento online, vamos falar pelo WhatsApp sobre disponibilidade e entrega.
          </p>
        </div>
      </div>
    </div>
  );
}
