/** Etiqueta de identificação do cliente: uma via 40×25 mm. */
export const ETIQUETA_CLIENTE_LARGURA_MM = 40;
export const ETIQUETA_CLIENTE_ALTURA_MM = 25;
export const ETIQUETA_CLIENTE_MARGEM_MM = 1;

/** Resolução de render (px por mm) — ~203 DPI térmica. */
const PX_POR_MM = 8;

export type EtiquetaClienteOpts = {
  nome: string;
  /** Texto digitado na hora da impressão. Vazio não sai na etiqueta. */
  referencia?: string | null;
  /** Momento impresso na etiqueta. Omitido usa o instante atual. */
  impressoEm?: Date | string | null;
};

/**
 * Formata data e hora da impressão como dd/mm/aaaa hh:mm.
 */
export function formatarDataHoraEtiquetaCliente(value?: Date | string | null): string {
  const d = value instanceof Date ? value : value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Quebra texto em linhas que cabem em maxWidth (px), inclusive palavras longas.
 */
function quebrarLinhas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const encaixa = (s: string) => ctx.measureText(s).width <= maxWidth;

  const partirPalavra = (word: string): string[] => {
    if (encaixa(word)) return [word];
    const parts: string[] = [];
    let chunk = "";
    for (const ch of word) {
      const t = chunk + ch;
      if (encaixa(t)) chunk = t;
      else {
        if (chunk) parts.push(chunk);
        chunk = ch;
      }
    }
    if (chunk) parts.push(chunk);
    return parts.length ? parts : [word.slice(0, 1)];
  };

  const tokens = raw.split(" ").flatMap(partirPalavra);
  const lines: string[] = [];
  let atual = "";

  for (const tok of tokens) {
    const join = atual ? `${atual} ${tok}` : tok;
    if (encaixa(join)) {
      atual = join;
      continue;
    }
    if (atual) lines.push(atual);
    atual = tok;
    if (lines.length >= maxLines) {
      atual = "";
      break;
    }
  }
  if (atual && lines.length < maxLines) lines.push(atual);
  if (lines.length > maxLines) lines.length = maxLines;

  const consumido = lines.join(" ");
  if (consumido.length < raw.length && lines.length > 0) {
    let last = lines[lines.length - 1]!;
    while (last.length > 1 && !encaixa(`${last}…`)) last = last.slice(0, -1);
    lines[lines.length - 1] = encaixa(`${last}…`) ? `${last}…` : last;
  }

  return lines;
}

/**
 * Desenha uma via 40×25 mm da etiqueta do cliente (nome, data/hora, referência).
 * Devolve um data URL PNG no tamanho de uma etiqueta.
 */
export function renderEtiquetaClienteDataUrl(opts: EtiquetaClienteOpts): string {
  const W = Math.round(ETIQUETA_CLIENTE_LARGURA_MM * PX_POR_MM);
  const H = Math.round(ETIQUETA_CLIENTE_ALTURA_MM * PX_POR_MM);
  const m = Math.round(ETIQUETA_CLIENTE_MARGEM_MM * PX_POR_MM);
  const contentW = W - m * 2;
  const contentH = H - m * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(m, m, contentW, contentH);
  ctx.clip();
  ctx.translate(m, m);

  const nome = (opts.nome ?? "").trim() || "—";
  const referencia = (opts.referencia ?? "").trim();
  const quando = formatarDataHoraEtiquetaCliente(opts.impressoEm);

  ctx.fillStyle = "#111111";
  ctx.textBaseline = "top";

  /** Nome grande: cabe em até duas linhas na via de 40 mm. */
  ctx.font = "700 32px Arial, Helvetica, sans-serif";
  const nomeLinhas = quebrarLinhas(ctx, nome, contentW, 2);
  let y = 0;
  for (const ln of nomeLinhas.length ? nomeLinhas : ["—"]) {
    ctx.fillText(ln, 0, y);
    y += 36;
  }

  y += 6;
  ctx.font = "700 18px Arial, Helvetica, sans-serif";
  const linhaQuando = quebrarLinhas(ctx, quando, contentW, 1)[0];
  if (linhaQuando) ctx.fillText(linhaQuando, 0, y);
  y += 22;

  if (referencia && y < contentH - 28) {
    ctx.font = "600 16px Arial, Helvetica, sans-serif";
    const linhaRef = quebrarLinhas(ctx, referencia, contentW, 1)[0];
    if (linhaRef) ctx.fillText(linhaRef, 0, y);
  }

  ctx.font = "700 18px Arial, Helvetica, sans-serif";
  ctx.fillText("Bike Time", 0, contentH - 20);

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Imprime uma via 40×25 mm pelo navegador quando o QZ Tray não está disponível.
 */
export function imprimirEtiquetaCliente(dataUrl: string) {
  const folhaW = ETIQUETA_CLIENTE_LARGURA_MM;
  const folhaH = ETIQUETA_CLIENTE_ALTURA_MM;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${folhaW}mm`;
  iframe.style.height = `${folhaH}mm`;
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível preparar a impressão.");
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta cliente</title>
  <style>
    @page { size: ${folhaW}mm ${folhaH}mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: ${folhaW}mm; height: ${folhaH}mm; overflow: hidden; background: #fff; }
    img { display: block; width: ${folhaW}mm; height: ${folhaH}mm; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Etiqueta do cliente" />
</body>
</html>`);
  doc.close();

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  };

  let printed = false;
  const triggerOnce = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      win.print();
    } finally {
      window.setTimeout(cleanup, 1500);
    }
  };

  const imgs = Array.from(doc.querySelectorAll("img"));
  const pendentes = imgs.filter((img) => !img.complete);
  if (pendentes.length > 0) {
    let restantes = pendentes.length;
    const done = () => {
      restantes -= 1;
      if (restantes <= 0) window.setTimeout(triggerOnce, 80);
    };
    for (const img of pendentes) {
      img.addEventListener("load", done);
      img.addEventListener("error", done);
    }
    window.setTimeout(triggerOnce, 2500);
  } else {
    window.setTimeout(triggerOnce, 200);
  }
}

/**
 * Gera a imagem da etiqueta do cliente e dispara a impressão no navegador.
 */
export function gerarEImprimirEtiquetaCliente(opts: EtiquetaClienteOpts) {
  const dataUrl = renderEtiquetaClienteDataUrl(opts);
  imprimirEtiquetaCliente(dataUrl);
}
