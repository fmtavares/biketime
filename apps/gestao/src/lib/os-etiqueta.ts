import { gerarQrDataUrl } from "@/lib/bike-adesivo";

/** Texto padrão quando o checklist de entrada está vazio. */
export const CHECKLIST_ENTRADA_PADRAO =
  "Nenhum acessório deixado junto à bike (nada mencionado na entrada).";

/** Página física da etiqueta (mm) — folha completa. */
export const ETIQUETA_LARGURA_MM = 100;
/** Altura de uma via (metade da folha física). */
export const ETIQUETA_ALTURA_MM = 75;
/** Altura da folha física: duas vias empilhadas. */
export const ETIQUETA_FOLHA_ALTURA_MM = 150;
/** Quantidade de vias impressas por folha. */
export const ETIQUETA_VIAS_POR_FOLHA = 2;
/** Margem interna em todos os lados (mm). */
export const ETIQUETA_MARGEM_MM = 2;
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
  ctx.textBaseline = "top";
  ctx.font = "900 48px Arial Black, Arial, Helvetica, sans-serif";
  const osNum = quebrarLinhas(ctx, opts.numero, leftW, 1)[0] ?? opts.numero;
  ctx.fillText(osNum, 0, y);
  y += 52;

  ctx.fillStyle = "#444444";
  ctx.font = "400 17px Arial, Helvetica, sans-serif";
  ctx.fillText("Comprovante de entrada", 0, y);
  y += 26;

  ctx.fillStyle = "#111111";
  ctx.font = "600 20px Arial, Helvetica, sans-serif";
  const metaLinhas = [cliente, bike, ...(codigo ? [codigo] : [])];
  for (const linha of metaLinhas) {
    for (const t of quebrarLinhas(ctx, linha, leftW, 1)) {
      ctx.fillText(t, 0, y);
      y += 24;
    }
  }
  ctx.restore();

  // QR à direita, alinhado ao topo
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
  ctx.textBaseline = "top";
  const bullet = "●";
  const sep = "   ";
  const parteEntrada = `${bullet} Entrada ${entrada}`;
  const partePrevisto = `${bullet} Previsto ${prevista}`;
  const linhaDatas = `${parteEntrada}${sep}${partePrevisto}`;

  let fontSize = 19;
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  while (fontSize > 14 && ctx.measureText(linhaDatas).width > contentW) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
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

  /**
   * Corpo: tipografia maior e altura preenchida.
   * Calcula quantas linhas cabem no espaço livre até o rodapé.
   */
  let by = dividerY + 10;
  const footerH = 44;
  const obsText =
    "Acompanhe a evolução da sua OS em biketime.com.br, fazendo login com seu e-mail e senha. Se ainda não tiver acesso, solicite na oficina.";

  const problemaLabel = 16;
  const problemaText = 22;
  const problemaLH = 26;
  const checkLabel = 15;
  const checkText = 19;
  const checkLH = 23;
  const obsLabel = 14;
  const obsTextSize = 17;
  const obsLH = 21;
  const gapBlocos = 14;

  const drawBloco = (
    label: string,
    text: string,
    maxLines: number,
    sizes: { labelSize: number; textSize: number; lineH: number },
  ) => {
    const { labelSize, textSize, lineH } = sizes;
    if (by >= contentH - footerH - lineH) return;
    ctx.fillStyle = "#555555";
    ctx.font = `700 ${labelSize}px Arial, Helvetica, sans-serif`;
    ctx.fillText(label.toUpperCase(), 0, by);
    by += labelSize + 5;
    ctx.fillStyle = "#111111";
    ctx.font = `500 ${textSize}px Arial, Helvetica, sans-serif`;
    const linhas = quebrarLinhas(ctx, text, contentW, maxLines);
    for (const ln of linhas) {
      if (by >= contentH - footerH - lineH) break;
      ctx.fillText(ln, 0, by);
      by += lineH;
    }
  };

  const checkLines = 2;
  const obsLines = 2;
  const checkReserve = checkLabel + 5 + checkLH * checkLines + gapBlocos;
  const obsReserve = obsLabel + 5 + obsLH * obsLines + gapBlocos;
  const problemaAvail = contentH - footerH - by - checkReserve - obsReserve;
  const problemaLines = Math.max(
    2,
    Math.floor((problemaAvail - problemaLabel - 5) / problemaLH),
  );

  drawBloco("Problema / serviço", problema, problemaLines, {
    labelSize: problemaLabel,
    textSize: problemaText,
    lineH: problemaLH,
  });
  by += gapBlocos;
  drawBloco("Checklist / acessórios", checklist, checkLines, {
    labelSize: checkLabel,
    textSize: checkText,
    lineH: checkLH,
  });
  by += gapBlocos;
  drawBloco("Observação", obsText, obsLines, {
    labelSize: obsLabel,
    textSize: obsTextSize,
    lineH: obsLH,
  });

  // Rodapé centralizado: site + slogan
  ctx.strokeStyle = "#cccccc";
  ctx.beginPath();
  ctx.moveTo(0, contentH - footerH);
  ctx.lineTo(contentW, contentH - footerH);
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  const footerCx = contentW / 2;
  ctx.font = "600 16px Arial, Helvetica, sans-serif";
  ctx.fillText("www.biketime.com.br", footerCx, contentH - footerH + 6);
  ctx.font = "600 15px Arial, Helvetica, sans-serif";
  ctx.fillText("It's Bike Time!", footerCx, contentH - footerH + 24);
  ctx.textAlign = "left";

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Imprime duas vias 100×75mm empilhadas na folha física 100×150mm.
 * Retrato (mais alto que largo) evita rotação "paisagem" do Chrome.
 */
export function imprimirEtiquetaOS(dataUrl: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = `${ETIQUETA_LARGURA_MM}mm`;
  iframe.style.height = `${ETIQUETA_FOLHA_ALTURA_MM}mm`;
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível preparar a impressão.");
  }

  const wMm = ETIQUETA_LARGURA_MM;
  const hMm = ETIQUETA_ALTURA_MM;
  const folhaH = ETIQUETA_FOLHA_ALTURA_MM;
  const vias = ETIQUETA_VIAS_POR_FOLHA;

  const viasHtml = Array.from({ length: vias }, (_, i) =>
    `<div class="via"><img src="${dataUrl}" alt="Etiqueta OS via ${i + 1}" /></div>`,
  ).join("");

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta OS</title>
  <style>
    @page {
      size: ${wMm}mm ${folhaH}mm;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${wMm}mm;
      height: ${folhaH}mm;
      overflow: hidden;
      background: #fff;
    }
    .folha {
      width: ${wMm}mm;
      height: ${folhaH}mm;
      display: flex;
      flex-direction: column;
    }
    .via {
      width: ${wMm}mm;
      height: ${hMm}mm;
      overflow: hidden;
      flex: 0 0 ${hMm}mm;
    }
    .via img {
      display: block;
      width: ${wMm}mm;
      height: ${hMm}mm;
      max-width: ${wMm}mm;
      max-height: ${hMm}mm;
      border: 0;
    }
    @media print {
      html, body, .folha {
        width: ${wMm}mm !important;
        height: ${folhaH}mm !important;
      }
      .via, .via img {
        width: ${wMm}mm !important;
        height: ${hMm}mm !important;
      }
    }
  </style>
</head>
<body>
  <div class="folha">
    ${viasHtml}
  </div>
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
 * Gera a imagem da etiqueta e dispara a impressão.
 */
export async function gerarEImprimirEtiquetaOS(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
) {
  const dataUrl = await renderEtiquetaOSDataUrl(opts);
  imprimirEtiquetaOS(dataUrl);
}
