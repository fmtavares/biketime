/**
 * Utilitários do histórico de observações da aprovação da OS.
 * Formato de cada entrada:
 * [Comentário Cliente — DD/MM/YYYY HH:MM]
 * texto
 */

export type EntradaObsAprovacao = {
  autor: "Cliente" | "Equipe" | "Anterior";
  data: string;
  texto: string;
};

/**
 * Formata data/hora no padrão do histórico (pt-BR).
 */
export function formatarDataObsAprovacao(d: Date = new Date()): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Monta uma entrada de histórico com cabeçalho de autor e data.
 */
export function formatarEntradaObsAprovacao(
  autor: "Cliente" | "Equipe",
  texto: string,
  data: Date = new Date(),
): string {
  const corpo = texto.trim();
  if (!corpo) return "";
  return `[Comentário ${autor} — ${formatarDataObsAprovacao(data)}]\n${corpo}`;
}

/**
 * Anexa uma nova entrada ao histórico existente (sem sobrescrever).
 */
export function appendObsAprovacao(
  existente: string | null | undefined,
  autor: "Cliente" | "Equipe",
  texto: string,
  data: Date = new Date(),
): string {
  const entrada = formatarEntradaObsAprovacao(autor, texto, data);
  if (!entrada) return String(existente ?? "").trim();
  const base = String(existente ?? "").trim();
  return base ? `${base}\n\n${entrada}` : entrada;
}

/**
 * Interpreta o texto gravado em entradas de histórico.
 */
export function parseHistoricoObsAprovacao(
  texto: string | null | undefined,
): EntradaObsAprovacao[] {
  const raw = String(texto ?? "").trim();
  if (!raw) return [];

  const blocos = raw.split(/\n(?=\[Comentário )/);
  return blocos.map((bloco) => {
    const m = bloco.match(
      /^\[Comentário (Cliente|Equipe) — ([^\]]+)\]\n?([\s\S]*)$/,
    );
    if (m) {
      return {
        autor: m[1] as "Cliente" | "Equipe",
        data: m[2].trim(),
        texto: m[3].trim(),
      };
    }
    return { autor: "Anterior" as const, data: "", texto: bloco.trim() };
  });
}
