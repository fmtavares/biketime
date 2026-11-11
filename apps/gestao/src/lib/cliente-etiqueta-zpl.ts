import {
  ETIQUETA_CLIENTE_ALTURA_MM,
  ETIQUETA_CLIENTE_LARGURA_MM,
  formatarDataHoraEtiquetaCliente,
  type EtiquetaClienteOpts,
} from "@/lib/cliente-etiqueta";

/** Resolução nativa da Elgin L42 Pro (203 dpi). */
const ZPL_DPI = 203;

/** Converte milímetros em dots a 203 dpi. */
function mmToDots(mm: number): number {
  return Math.round((mm * ZPL_DPI) / 25.4);
}

/**
 * Escapa texto para campo ^FD do ZPL (remove controles e limita tamanho).
 */
function zplText(raw: string, maxLen = 80): string {
  return (raw ?? "")
    .replace(/[\^~\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Quebra o texto em linhas que cabem na largura da etiqueta.
 * A Elgin L42 recusa o job (erro no painel) quando um ^A0 é mais largo que ^PW.
 * Por isso o nome não usa ^FB: cada linha já sai com largura de caractere que cabe.
 */
function quebrarZpl(text: string, maxChars: number, maxLines: number): string[] {
  const raw = zplText(text, maxChars * maxLines);
  if (!raw) return [];
  const words = raw.split(" ");
  const lines: string[] = [];
  let atual = "";

  const empurra = (pedaço: string) => {
    if (lines.length >= maxLines) return;
    lines.push(pedaço);
  };

  for (const word of words) {
    const partes: string[] = [];
    if (word.length <= maxChars) partes.push(word);
    else {
      for (let i = 0; i < word.length; i += maxChars) partes.push(word.slice(i, i + maxChars));
    }
    for (const parte of partes) {
      const join = atual ? `${atual} ${parte}` : parte;
      if (join.length <= maxChars) {
        atual = join;
        continue;
      }
      if (atual) empurra(atual);
      atual = lines.length >= maxLines ? "" : parte;
    }
  }
  if (atual && lines.length < maxLines) empurra(atual);

  if (lines.join(" ").length < raw.length && lines.length > 0) {
    const last = lines[lines.length - 1]!;
    lines[lines.length - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : last;
  }
  return lines;
}

/**
 * Desenha uma via 40×25 mm a partir da origem (ox, oy), em dots.
 * A referência só entra se tiver texto.
 */
function zplViaCliente(opts: EtiquetaClienteOpts, ox: number, oy: number): string {
  const viaW = mmToDots(ETIQUETA_CLIENTE_LARGURA_MM);
  const viaH = mmToDots(ETIQUETA_CLIENTE_ALTURA_MM);
  const m = mmToDots(1);
  const textW = viaW - m * 2;
  const x = ox + m;

  /** Largura do glifo cabe em textW; altura um pouco maior para leitura. */
  const nomeW = 13;
  const nomeH = 26;
  const nomeChars = Math.floor(textW / nomeW);
  const nomeLinhas = quebrarZpl(opts.nome || "—", nomeChars, 2);

  const infoW = 11;
  const infoH = 20;
  const infoChars = Math.floor(textW / infoW);
  const quando = zplText(formatarDataHoraEtiquetaCliente(opts.impressoEm), infoChars);
  const referencia = zplText(opts.referencia ?? "", infoChars);

  const linhas: string[] = [];
  let y = oy + m;
  for (const ln of nomeLinhas.length ? nomeLinhas : ["—"]) {
    linhas.push(`^FO${x},${y}^A0N,${nomeH},${nomeW}^FD${ln}^FS`);
    y += nomeH + 2;
  }

  y += 4;
  linhas.push(`^FO${x},${y}^A0N,${infoH},${infoW}^FD${quando}^FS`);
  y += infoH + 4;
  if (referencia) {
    linhas.push(`^FO${x},${y}^A0N,${infoH},${infoW}^FD${referencia}^FS`);
  }

  const footerY = oy + viaH - m - infoH;
  linhas.push(`^FO${x},${footerY}^A0N,${infoH},${infoW}^FDBike Time^FS`);
  return linhas.join("\n");
}

/**
 * Gera o ZPL de uma etiqueta de cliente, 40×25 mm, UTF-8.
 * Uma via só, sem ^FB: a Elgin L42PRO acusa erro se o texto ultrapassa a largura.
 */
export function gerarZplEtiquetaCliente(opts: EtiquetaClienteOpts): string {
  const folhaW = mmToDots(ETIQUETA_CLIENTE_LARGURA_MM);
  const folhaH = mmToDots(ETIQUETA_CLIENTE_ALTURA_MM);

  return [
    "^XA",
    "^CI28",
    `^PW${folhaW}`,
    `^LL${folhaH}`,
    "^LH0,0",
    zplViaCliente(opts, 0, 0),
    "^PQ1",
    "^XZ",
  ].join("\n");
}
