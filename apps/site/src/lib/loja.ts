import type { Tables } from "@/integrations/supabase/types";

export type LojaBike = Tables<"loja_bikes">;
export type LojaProduto = Tables<"loja_produtos">;

const WA_NUMBER = "5511961680346";

/** Formata preço em BRL. */
export function fmtPreco(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export type PrecoPromocional = {
  mercado: number;
  promocional: number;
  /** Percentual inteiro de desconto (ex.: 18). Null se não houver oferta. */
  descontoPct: number | null;
};

/**
 * Calcula desconto entre valor de mercado e preço promocional.
 * Só retorna % se mercado > promocional > 0.
 */
export function calcDesconto(
  valorMercado: number | null | undefined,
  valorPromocional: number | null | undefined,
): PrecoPromocional {
  const mercado = Number(valorMercado) || 0;
  const promocional = Number(valorPromocional) || 0;
  const temDesconto = mercado > promocional && promocional > 0;
  const descontoPct = temDesconto
    ? Math.round(((mercado - promocional) / mercado) * 100)
    : null;
  return { mercado, promocional, descontoPct };
}

/** Monta URL de WhatsApp com interesse na bike do showroom. */
export function whatsappInteresse(bike: Pick<LojaBike, "marca" | "modelo" | "valor_proposto">) {
  const nome = `${bike.marca} ${bike.modelo}`.trim();
  const preco = fmtPreco(bike.valor_proposto);
  const text = `Olá! Tenho interesse na bike: ${nome} — ${preco} (showroom BikeTime)`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Monta URL de WhatsApp com interesse em produto/acessório do showroom. */
export function whatsappInteresseProduto(
  produto: Pick<LojaProduto, "nome" | "marca" | "modelo" | "preco_venda">,
) {
  const nome = [produto.marca, produto.nome || produto.modelo].filter(Boolean).join(" ").trim();
  const preco = fmtPreco(produto.preco_venda);
  const text = `Olá! Tenho interesse no produto: ${nome} — ${preco} (showroom BikeTime)`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Primeira foto do array de fotos do produto. */
export function fotoProduto(produto: Pick<LojaProduto, "fotos">) {
  return produto.fotos?.[0] ?? null;
}

/**
 * Retorna o texto da etiqueta de condição para o showroom
 * (seminova / usado). Null se for nova ou vazia.
 */
export function etiquetaCondicao(condicao: string | null | undefined): string | null {
  const c = (condicao ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
  if (!c) return null;
  if (c.includes("seminov")) return "Seminova";
  if (c.includes("usad")) return "Usado";
  return null;
}

const SITE_ORIGIN = "https://biketime.com.br";

/** URL canônica de uma bike no showroom. */
export function urlShowroomBike(id: string) {
  return `${SITE_ORIGIN}/loja/${id}`;
}

/** URL canônica de um produto no showroom. */
export function urlShowroomProduto(id: string) {
  return `${SITE_ORIGIN}/loja/produto/${id}`;
}

/** Título curto para compartilhar / Open Graph (bike). */
export function tituloCompartilharBike(
  bike: Pick<LojaBike, "marca" | "modelo">,
) {
  return `${bike.marca} ${bike.modelo}`.trim();
}

/** Descrição curta e marketeira para OG / Web Share (bike). */
export function descricaoCompartilharBike(
  bike: Pick<LojaBike, "ano" | "tamanho" | "cor" | "condicao" | "categoria" | "valor_proposto">,
) {
  const meta = [
    bike.ano && String(bike.ano),
    bike.tamanho && `Tam. ${bike.tamanho}`,
    bike.cor,
    bike.condicao,
    bike.categoria,
  ]
    .filter(Boolean)
    .join(" · ");
  const preco = bike.valor_proposto ? fmtPreco(bike.valor_proposto) : null;
  const partes = [
    meta || null,
    preco ? `${preco} no showroom BikeTime` : "Disponível no showroom BikeTime",
  ].filter(Boolean);
  return partes.join(" — ");
}

/** Texto do Web Share / clipboard para bike. */
export function textoCompartilharBike(
  bike: Pick<LojaBike, "id" | "marca" | "modelo">,
) {
  const nome = tituloCompartilharBike(bike);
  return `${nome} · Showroom BikeTime\n${urlShowroomBike(bike.id)}`;
}

/** Título curto para compartilhar / Open Graph (produto). */
export function tituloCompartilharProduto(
  produto: Pick<LojaProduto, "nome" | "marca">,
) {
  return [produto.marca, produto.nome].filter(Boolean).join(" ").trim();
}

/** Descrição curta para OG / Web Share (produto). */
export function descricaoCompartilharProduto(
  produto: Pick<LojaProduto, "categoria" | "modelo" | "preco_venda" | "descricao">,
) {
  const meta = [produto.categoria, produto.modelo].filter(Boolean).join(" · ");
  const preco = produto.preco_venda ? fmtPreco(produto.preco_venda) : null;
  const gancho =
    produto.descricao?.trim().split(/\n/)[0]?.slice(0, 120) ||
    (preco ? `${preco} no showroom BikeTime` : "Disponível no showroom BikeTime");
  return [meta || null, gancho].filter(Boolean).join(" — ");
}

/** Texto do Web Share / clipboard para produto. */
export function textoCompartilharProduto(
  produto: Pick<LojaProduto, "id" | "nome" | "marca">,
) {
  const nome = tituloCompartilharProduto(produto);
  return `${nome} · Showroom BikeTime\n${urlShowroomProduto(produto.id)}`;
}

type MetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

/**
 * Meta tags Open Graph / Twitter para um item do showroom (preview no WhatsApp).
 */
export function metaTagsShowroom(opts: {
  title: string;
  description: string;
  url: string;
  image?: string | null;
}): MetaTag[] {
  const title = `${opts.title} · Showroom BikeTime`;
  const tags: MetaTag[] = [
    { title },
    { name: "description", content: opts.description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "BikeTime" },
    { property: "og:title", content: title },
    { property: "og:description", content: opts.description },
    { property: "og:url", content: opts.url },
    { name: "twitter:card", content: opts.image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: opts.description },
  ];
  if (opts.image) {
    tags.push(
      { property: "og:image", content: opts.image },
      { name: "twitter:image", content: opts.image },
    );
  }
  return tags;
}
