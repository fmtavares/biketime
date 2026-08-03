import { gerarQrDataUrl } from "@/lib/bike-adesivo";

/** Texto padrão quando o checklist de entrada está vazio. */
export const CHECKLIST_ENTRADA_PADRAO =
  "Nenhum acessório deixado junto à bike (nada mencionado na entrada).";

/** Página física da etiqueta (mm). */
export const ETIQUETA_LARGURA_MM = 100;
export const ETIQUETA_ALTURA_MM = 75;
/** Margem interna em todos os lados (mm). */
export const ETIQUETA_MARGEM_MM = 1;
/** Resolução de render (px por mm) — ~203 DPI térmica. */
const PX_POR_MM = 8;

export type EtiquetaOSOpts = {
  numero: string;
  clienteNome: string;
  marca: string;
  modelo: string;
  codigoBike?: string | null;
  dataEntrada?: string | null;
  dataPrevista?: string | null;
  problemaRelatado?: string | null;
  checklistEntrada?: string | null;
};

/**
 * Formata data ISO/date para pt-BR (só dia).
 */
export function formatarDataEtiqueta(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/**
 * Formata data curta dd/mm/yy para a etiqueta.
 */
export function formatarDataEtiquetaCurta(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Resolve o texto do checklist: campo preenchido ou aviso de nenhum acessório.
 */
export function textoChecklistEtiqueta(checklist?: string | null): string {
  const t = (checklist ?? "").trim();
  return t || CHECKLIST_ENTRADA_PADRAO;
}

/**
 * Título da bike para a etiqueta (marca + modelo).
 */
export function tituloBikeEtiqueta(opts: Pick<EtiquetaOSOpts, "marca" | "modelo">) {
  return `${opts.marca ?? ""} ${opts.modelo ?? ""}`.trim() || "—";
}

/**
 * Gera QR da bike quando há código; senão retorna null (etiqueta sem QR).
 */
export async function gerarQrEtiquetaOS(
  codigoBike?: string | null,
): Promise<string | null> {
  const code = (codigoBike ?? "").trim();
  if (!code) return null;
  return gerarQrDataUrl(code);
}

/**
 * Carrega imagem a partir de data URL / URL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
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
  const raw = text.replace(/\s+/g, " ").trim() || "—";
  const encaixa = (s: string) => ctx.measureText(s).width <= maxWidth;

  /** Parte uma palavra maior que a largura em pedaços. */
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

  return lines.length ? lines : ["—"];
}

/**
 * Desenha a etiqueta inteira em canvas no tamanho físico exato (100×75mm).
 * Evita o estouro lateral do HTML/CSS na impressão térmica.
 */
export async function renderEtiquetaOSDataUrl(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
): Promise<string> {
  const W = Math.round(ETIQUETA_LARGURA_MM * PX_POR_MM);
  const H = Math.round(ETIQUETA_ALTURA_MM * PX_POR_MM);
  const m = Math.round(ETIQUETA_MARGEM_MM * PX_POR_MM);
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

  const bike = tituloBikeEtiqueta(opts);
  const cliente = (opts.clienteNome ?? "").trim() || "—";
  const problema = (opts.problemaRelatado ?? "").trim() || "—";
  const checklist = textoChecklistEtiqueta(opts.checklistEntrada);
  const entrada = formatarDataEtiquetaCurta(opts.dataEntrada);
  const prevista = formatarDataEtiquetaCurta(opts.dataPrevista);
  const codigo = (opts.codigoBike ?? "").trim();

  const gap = Math.round(2 * PX_POR_MM);
  const qrCol = Math.round(24 * PX_POR_MM);
  const qrSize = Math.round(22 * PX_POR_MM);
  const leftW = contentW - qrCol - gap;

  // —— Cabeçalho esquerdo (clipado para não invadir o QR) ——
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, leftW, contentH);
  ctx.clip();

  let y = 0;
  ctx.fillStyle = "#111111";
  ctx.font = "800 28px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "top";
  const brand = "BikeTime";
  ctx.fillText(brand, 0, y);
  const brandW = ctx.measureText(brand).width;

  ctx.font = "800 26px Courier New, monospace";
  const osNum = quebrarLinhas(ctx, opts.numero, Math.max(40, leftW - brandW - 12), 1)[0] ?? opts.numero;
  ctx.fillText(osNum, brandW + 12, y + 2);
  y += 32;

  ctx.fillStyle = "#444444";
  ctx.font = "400 14px Arial, Helvetica, sans-serif";
  ctx.fillText("Comprovante de entrada", 0, y);
  y += 28;

  ctx.fillStyle = "#111111";
  ctx.font = "600 16px Arial, Helvetica, sans-serif";
  const metaLinhas = [
    `Cliente: ${cliente}`,
    `Bike: ${bike}`,
    ...(codigo ? [`Código: ${codigo}`] : []),
  ];
  for (const linha of metaLinhas) {
    for (const t of quebrarLinhas(ctx, linha, leftW, 1)) {
      ctx.fillText(t, 0, y);
      y += 20;
    }
  }
  ctx.restore();

  // QR à direita, alinhado ao topo com BikeTime
  const qrX = leftW + gap + Math.round((qrCol - qrSize) / 2);
  if (opts.qrDataUrl) {
    try {
      const qrImg = await loadImage(opts.qrDataUrl);
      ctx.drawImage(qrImg, qrX, 0, qrSize, qrSize);
    } catch {
      /* segue sem QR */
    }
  }

  const headerBottom = Math.max(y, qrSize) + 6;

  // Linha divisória
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, headerBottom);
  ctx.lineTo(contentW, headerBottom);
  ctx.stroke();

  // Datas em uma única linha: ● Entrada dd/mm/yy   ● Previsto dd/mm/yy
  const datesY = headerBottom + 8;
  ctx.font = "600 14px Arial, Helvetica, sans-serif";
  ctx.textBaseline = "top";
  const bullet = "●";
  const sep = "   ";
  const parteEntrada = `${bullet} Entrada ${entrada}`;
  const partePrevisto = `${bullet} Previsto ${prevista}`;
  const linhaDatas = `${parteEntrada}${sep}${partePrevisto}`;

  // Se não couber na largura, reduz um pouco a fonte
  let fontSize = 14;
  ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
  while (fontSize > 11 && ctx.measureText(linhaDatas).width > contentW) {
    fontSize -= 1;
    ctx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
  }

  ctx.fillStyle = "#111111";
  let dx = 0;
  ctx.fillText(parteEntrada, dx, datesY);
  dx += ctx.measureText(parteEntrada).width + ctx.measureText(sep).width;
  ctx.fillText(partePrevisto, dx, datesY);

  const dividerY = datesY + fontSize + 10;
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, dividerY);
  ctx.lineTo(contentW, dividerY);
  ctx.stroke();

  // Corpo (problema + checklist + observação)
  let by = dividerY + 8;
  const footerH = 18;
  const obsText =
    "Acompanhe a evolução da sua OS em biketime.com.br, fazendo login com seu e-mail e senha. Se ainda não tiver acesso, solicite na oficina.";

  const drawBloco = (
    label: string,
    text: string,
    maxLines: number,
    opts?: { labelSize?: number; textSize?: number; lineH?: number },
  ) => {
    const labelSize = opts?.labelSize ?? 12;
    const textSize = opts?.textSize ?? 16;
    const lineH = opts?.lineH ?? 19;
    if (by >= contentH - footerH - 24) return;
    ctx.fillStyle = "#555555";
    ctx.font = `700 ${labelSize}px Arial, Helvetica, sans-serif`;
    ctx.fillText(label.toUpperCase(), 0, by);
    by += labelSize + 4;
    ctx.fillStyle = "#111111";
    ctx.font = `500 ${textSize}px Arial, Helvetica, sans-serif`;
    const linhas = quebrarLinhas(ctx, text, contentW, maxLines);
    for (const ln of linhas) {
      if (by >= contentH - footerH - lineH) break;
      ctx.fillText(ln, 0, by);
      by += lineH;
    }
  };

  drawBloco("Problema / serviço", problema, 2);
  by += 12;
  drawBloco("Checklist / acessórios", checklist, 2);
  by += 12;
  drawBloco("Observação", obsText, 3, {
    labelSize: 11,
    textSize: 12,
    lineH: 15,
  });

  // Rodapé
  ctx.strokeStyle = "#cccccc";
  ctx.beginPath();
  ctx.moveTo(0, contentH - footerH);
  ctx.lineTo(contentW, contentH - footerH);
  ctx.stroke();
  ctx.fillStyle = "#333333";
  ctx.font = "500 11px Arial, Helvetica, sans-serif";
  ctx.fillText("biketime.com.br · It's Bike Time — Perdizes", 0, contentH - footerH + 4);

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Imprime a etiqueta como imagem de tamanho fixo (100×75mm).
 * Mais estável em impressoras térmicas do que HTML/CSS com @page.
 */
export function imprimirEtiquetaOS(dataUrl: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${ETIQUETA_LARGURA_MM}mm`;
  iframe.style.height = `${ETIQUETA_ALTURA_MM}mm`;
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
  <title>Etiqueta OS</title>
  <style>
    @page { size: ${ETIQUETA_LARGURA_MM}mm ${ETIQUETA_ALTURA_MM}mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${ETIQUETA_LARGURA_MM}mm;
      height: ${ETIQUETA_ALTURA_MM}mm;
      overflow: hidden;
      background: #fff;
    }
    img {
      display: block;
      width: ${ETIQUETA_LARGURA_MM}mm;
      height: ${ETIQUETA_ALTURA_MM}mm;
      max-width: ${ETIQUETA_LARGURA_MM}mm;
      max-height: ${ETIQUETA_ALTURA_MM}mm;
      object-fit: fill;
    }
  </style>
</head>
<body>
  <img src="${dataUrl}" width="${Math.round(ETIQUETA_LARGURA_MM * PX_POR_MM)}" height="${Math.round(ETIQUETA_ALTURA_MM * PX_POR_MM)}" alt="Etiqueta OS" />
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

  const img = doc.querySelector("img");
  if (img && !img.complete) {
    img.addEventListener("load", () => window.setTimeout(triggerOnce, 50));
    img.addEventListener("error", () => window.setTimeout(triggerOnce, 50));
    window.setTimeout(triggerOnce, 2000);
  } else {
    window.setTimeout(triggerOnce, 150);
  }
}

/**
 * Gera a imagem da etiqueta e dispara a impressão.
 */
export async function gerarEImprimirEtiquetaOS(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
) {
  const dataUrl = await renderEtiquetaOSDataUrl(opts);
  imprimirEtiquetaOS(dataUrl);
}
