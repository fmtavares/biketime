import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Package, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { chaveProduto, useCarrinho } from "@/lib/carrinho";
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

export type ProdutoVarianteShowroom = {
  id: string;
  tamanho: string;
  estoque: number;
  ativo: boolean;
};

export const Route = createFileRoute("/loja_/produto/$id")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("loja_produtos")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    if (error) throw error;

    const produto = (data as LojaProduto | null) ?? null;
    let variantes: ProdutoVarianteShowroom[] = [];

    if (produto) {
      const { data: vars } = await supabase
        .from("produto_variantes")
        .select("id, tamanho, estoque, ativo")
        .eq("produto_id", params.id)
        .eq("ativo", true);

      variantes = (vars ?? [])
        .map((v) => ({
          id: v.id,
          tamanho: v.tamanho,
          estoque: Number(v.estoque) || 0,
          ativo: !!v.ativo,
        }))
        .sort((a, b) => a.tamanho.localeCompare(b.tamanho, "pt-BR", { numeric: true }));
    }

    return { produto, variantes };
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
 * Detalhe de um produto do showroom.
 * O botão principal adiciona ao carrinho; o WhatsApp fica como contato.
 * Se houver variantes, o tamanho é obrigatório antes de adicionar.
 */
function LojaProdutoDetalhePage() {
  const { produto, variantes: variantesLoader } = Route.useLoaderData();
  const navigate = useNavigate();
  const { adicionar } = useCarrinho();
  const [tamanho, setTamanho] = useState<string>("");
  const variantes: ProdutoVarianteShowroom[] = variantesLoader ?? [];

  const temVariantes = variantes.length > 0;
  const disponiveis = useMemo(
    () => variantes.filter((v) => v.estoque > 0),
    [variantes],
  );

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
  const tamanhoEfetivo = tamanho || (disponiveis.length === 1 ? disponiveis[0].tamanho : "");
  const wa = whatsappInteresseProduto(produto, temVariantes ? tamanhoEfetivo || null : null);
  const nome = tituloCompartilharProduto(produto);
  const precisaTamanho = temVariantes && !tamanhoEfetivo;

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

          {temVariantes && (
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tamanho
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variantes.map((v) => {
                  const esgotado = v.estoque <= 0;
                  const selected = tamanhoEfetivo === v.tamanho;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={esgotado}
                      onClick={() => setTamanho(v.tamanho)}
                      className={[
                        "min-w-[3rem] rounded-md border px-3 py-2 text-sm font-medium transition",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:border-foreground",
                        esgotado ? "cursor-not-allowed opacity-40 line-through" : "",
                      ].join(" ")}
                      title={esgotado ? "Esgotado" : `Estoque: ${v.estoque}`}
                    >
                      {v.tamanho}
                    </button>
                  );
                })}
              </div>
              {disponiveis.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tamanhos esgotados no momento — fale conosco pelo WhatsApp.
                </p>
              )}
            </div>
          )}

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
            <button
              type="button"
              disabled={precisaTamanho}
              onClick={() => {
                if (!produto || precisaTamanho) return;
                const variante = variantes.find((v) => v.tamanho === tamanhoEfetivo);
                adicionar({
                  chave: chaveProduto(produto.id, variante?.id),
                  tipo: "produto",
                  produtoId: produto.id,
                  varianteId: variante?.id ?? null,
                  nome: produto.nome,
                  tamanho: tamanhoEfetivo || null,
                  quantidade: 1,
                  preco: Number(produto.preco_venda) || 0,
                  foto,
                });
                toast.success("Produto adicionado ao carrinho");
                navigate({ to: "/loja/carrinho" });
              }}
              className={[
                "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition",
                precisaTamanho ? "cursor-not-allowed opacity-60" : "hover:opacity-90",
              ].join(" ")}
            >
              <ShoppingBag size={18} />
              {precisaTamanho ? "Escolha o tamanho" : "Adicionar ao carrinho"}
            </button>
            <a
              href={precisaTamanho ? undefined : wa}
              onClick={(e) => {
                if (precisaTamanho) e.preventDefault();
              }}
              target="_blank"
              rel="noreferrer"
              aria-disabled={precisaTamanho}
              className={[
                "inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold transition",
                precisaTamanho ? "cursor-not-allowed opacity-60" : "hover:bg-secondary",
              ].join(" ")}
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <CompartilharShowroom
              title={`${nome} · Showroom BikeTime`}
              text={textoCompartilharProduto(produto)}
              url={urlShowroomProduto(produto.id)}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem pagamento online. A loja confirma a disponibilidade e a retirada.
          </p>
        </div>
      </div>
    </div>
  );
}
