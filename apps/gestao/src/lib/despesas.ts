/**
 * Helpers de competência e vencimento para despesas / recorrentes.
 */

/** Primeiro dia do mês (YYYY-MM-01) a partir de ano/mês 1–12. */
export function competenciaMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

/** Competência do mês atual. */
export function competenciaAtual(): string {
  const d = new Date();
  return competenciaMes(d.getFullYear(), d.getMonth() + 1);
}

/**
 * Data de vencimento no mês (dia 1–28) como YYYY-MM-DD.
 */
export function vencimentoNoMes(ano: number, mes: number, dia: number): string {
  const d = Math.min(28, Math.max(1, dia));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Label curto do mês (ex.: jul/2026). */
export function labelCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const nome = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
  return nome.replace(".", "");
}

export const FORMAS_PAGAMENTO_DESPESA = [
  "Dinheiro",
  "Pix",
  "Cartão",
  "Boleto",
  "Transferência",
  "Débito automático",
] as const;
