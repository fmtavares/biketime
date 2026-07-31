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
