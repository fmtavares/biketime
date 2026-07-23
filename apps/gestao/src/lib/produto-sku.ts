import { supabase } from "@/integrations/supabase/client";
import { slugifyNome } from "@/lib/produto-categoria";

/**
 * Extrai código de 3 letras a partir do slug (ex.: "oculos" → "OCU", "high-one" → "HIG").
 */
export function skuCodeFromSlug(slug: string): string {
  const compact = slugifyNome(slug).replace(/-/g, "");
  const code = compact.slice(0, 3).toUpperCase();
  return code.padEnd(3, "X");
}

/**
 * Monta o prefixo CAT-MAR (ex.: CAP-GIR).
 */
export function skuPrefix(categoriaSlug: string, marcaSlug: string): string {
  return `${skuCodeFromSlug(categoriaSlug)}-${skuCodeFromSlug(marcaSlug)}`;
}

/**
 * Gera o próximo SKU no formato CAT-MAR-NNN consultando produtos existentes.
 * Ex.: Capacete + Giro → CAP-GIR-001, CAP-GIR-002…
 */
export async function gerarProximoSku(
  categoriaSlug: string,
  marcaSlug: string,
): Promise<string> {
  const prefix = skuPrefix(categoriaSlug, marcaSlug);
  const { data, error } = await supabase
    .from("produtos")
    .select("sku")
    .ilike("sku", `${prefix}-%`);

  if (error) throw error;

  let max = 0;
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`, "i");
  for (const row of data ?? []) {
    const m = (row.sku ?? "").match(re);
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }

  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
