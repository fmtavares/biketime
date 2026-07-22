import type { Tables } from "@/integrations/supabase/types";

export type LojaBike = Tables<"loja_bikes">;

const WA_NUMBER = "5511961680346";

/** Formata preço em BRL. */
export function fmtPreco(n: number | null | undefined) {
  return (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Monta URL de WhatsApp com interesse na bike do showroom. */
export function whatsappInteresse(bike: Pick<LojaBike, "marca" | "modelo" | "valor_proposto">) {
  const nome = `${bike.marca} ${bike.modelo}`.trim();
  const preco = fmtPreco(bike.valor_proposto);
  const text = `Olá! Tenho interesse na bike: ${nome} — ${preco} (showroom BikeTime)`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}
