/**
 * Gera slug estável a partir de um nome (ex.: "Óculos" → "oculos", "High One" → "high-one").
 */
export function slugifyNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @deprecated Use slugifyNome — mantido para compatibilidade. */
export const slugifyCategoria = slugifyNome;
