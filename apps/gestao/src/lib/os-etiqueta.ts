import { gerarQrDataUrlFromUrl, urlQrOs } from "@/lib/bike-adesivo";

/** Texto padrão quando o checklist de entrada está vazio. */
export const CHECKLIST_ENTRADA_PADRAO =
  "Nenhum acessório deixado junto à bike (nada mencionado na entrada).";

/** Formatos de etiqueta OS. */
export type FormatoEtiquetaOS = "dupla" | "simples" | "pequena";

type SpecEtiqueta = {
  /** Largura de uma via (imagem). */
  larguraMm: number;
  /** Altura de uma via (imagem). */
  alturaViaMm: number;
  /** Largura da folha física impressa. */
  folhaLarguraMm: number;
  /** Altura da folha física impressa. */
  folhaAlturaMm: number;
  vias: number;
  /** Empilhamento das vias na folha. */
  layout: "coluna" | "linha";
  /** Espaço entre vias na folha (mm). */
  gapMm: number;
  margemMm: number;
};

const SPECS: Record<FormatoEtiquetaOS, SpecEtiqueta> = {
  dupla: {
    larguraMm: 100,
    alturaViaMm: 75,
    folhaLarguraMm: 100,
    folhaAlturaMm: 150,
    vias: 2,
    layout: "coluna",
    gapMm: 0,
    margemMm: 2,
  },
  simples: {
    larguraMm: 78,
    alturaViaMm: 70,
    folhaLarguraMm: 78,
    folhaAlturaMm: 70,
    vias: 1,
    layout: "coluna",
    gapMm: 0,
    margemMm: 2,
  },
  /** Duas vias 40×25mm lado a lado, com 2mm no meio (folha 82×25). */
  pequena: {
    larguraMm: 40,
    alturaViaMm: 25,
    folhaLarguraMm: 82,
    folhaAlturaMm: 25,
    vias: 2,
    layout: "linha",
    gapMm: 2,
    margemMm: 1,
  },
};

/** Specs da OS dupla (compat / UI). */
export const ETIQUETA_LARGURA_MM = SPECS.dupla.larguraMm;
export const ETIQUETA_ALTURA_MM = SPECS.dupla.alturaViaMm;
export const ETIQUETA_FOLHA_ALTURA_MM = SPECS.dupla.folhaAlturaMm;
export const ETIQUETA_VIAS_POR_FOLHA = SPECS.dupla.vias;
export const ETIQUETA_MARGEM_MM = SPECS.dupla.margemMm;

/** Specs da OS simples. */
export const ETIQUETA_SIMPLES_LARGURA_MM = SPECS.simples.larguraMm;
export const ETIQUETA_SIMPLES_ALTURA_MM = SPECS.simples.alturaViaMm;
export const ETIQUETA_SIMPLES_MARGEM_MM = SPECS.simples.margemMm;

/** Resolução de render (px por mm) — ~203 DPI térmica. */
const PX_POR_MM = 8;

/**
 * Retorna as medidas físicas do formato de etiqueta.
 */
export function specEtiquetaOS(formato: FormatoEtiquetaOS): SpecEtiqueta {
  return SPECS[formato];
}

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
 * Gera QR da etiqueta apontando para a OS (URL pública `/os/{numero}`).
 * Sem número → etiqueta sem QR.
 */
export async function gerarQrEtiquetaOS(
  numeroOs?: string | null,
): Promise<string | null> {
  const numero = (numeroOs ?? "").trim();
  if (!numero) return null;
  return gerarQrDataUrlFromUrl(urlQrOs(numero));
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
 * Layout compacto 40×25mm: QR no topo com o título;
 * serviço usa a faixa larga logo abaixo do QR até o rodapé.
 */
async function renderEtiquetaOSPequenaDataUrl(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
): Promise<string> {
  const spec = SPECS.pequena;
  const W = Math.round(spec.larguraMm * PX_POR_MM);
  const H = Math.round(spec.alturaViaMm * PX_POR_MM);
  const m = Math.round(spec.margemMm * PX_POR_MM);
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
  const entrada = formatarDataEtiquetaCurta(opts.dataEntrada);
  const prevista = formatarDataEtiquetaCurta(opts.dataPrevista);

  const gap = 4;
  const qrSize = Math.round(11 * PX_POR_MM); // ~11mm, alinhado ao topo
  const leftW = Math.max(40, contentW - qrSize - gap);
  /** Faixa do serviço: um pouco abaixo do QR até o fim. */
  const servicoTop = qrSize + 5;
  const labelServicoH = 12;
  const servicoLH = 13;
  const servicoAvail = contentH - servicoTop - labelServicoH;
  const servicoLines = Math.max(2, Math.floor(servicoAvail / servicoLH));

  ctx.textBaseline = "top";
  let y = 0;

  // QR alinhado ao topo com o título da OS
  if (opts.qrDataUrl) {
    try {
      const qrImg = await loadImage(opts.qrDataUrl);
      ctx.drawImage(qrImg, contentW - qrSize, 0, qrSize, qrSize);
    } catch {
      /* segue sem QR */
    }
  }

  ctx.fillStyle = "#111111";
  ctx.font = "900 24px Arial Black, Arial, Helvetica, sans-serif";
  const osNum = quebrarLinhas(ctx, opts.numero, leftW, 1)[0] ?? opts.numero;
  ctx.fillText(osNum, 0, y);
  y += 26;

  ctx.font = "600 12px Arial, Helvetica, sans-serif";
  for (const ln of quebrarLinhas(ctx, cliente, leftW, 1)) {
    if (y + 13 > servicoTop) break;
    ctx.fillText(ln, 0, y);
    y += 14;
  }
  for (const ln of quebrarLinhas(ctx, bike, leftW, 1)) {
    if (y + 13 > servicoTop) break;
    ctx.fillText(ln, 0, y);
    y += 14;
  }

  // ▶ = chegou na oficina; ⏱ = prazo à frente
  ctx.font = "600 11px Arial, Helvetica, sans-serif";
  const datas = [`▶ Entrada ${entrada}`, `⏱ Previsto ${prevista}`];
  for (const data of datas) {
    for (const ln of quebrarLinhas(ctx, data, leftW, 1)) {
      if (y + 12 > servicoTop) break;
      ctx.fillText(ln, 0, y);
      y += 13;
    }
  }

  // Resumo do serviço: largura total, da base do QR até o rodapé
  let sy = servicoTop;
  ctx.fillStyle = "#555555";
  ctx.font = "700 10px Arial, Helvetica, sans-serif";
  ctx.fillText("SERVIÇO", 0, sy);
  sy += labelServicoH;
  ctx.fillStyle = "#111111";
  ctx.font = "500 12px Arial, Helvetica, sans-serif";
  const linhasServico = quebrarLinhas(ctx, problema, contentW, servicoLines);
  for (const ln of linhasServico) {
    if (sy + servicoLH > contentH + 2) break;
    ctx.fillText(ln, 0, sy);
    sy += servicoLH;
  }

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Desenha a etiqueta em canvas no tamanho físico do formato.
 * Dupla/simples: layout completo; pequena: layout compacto 40×25.
 */
export async function renderEtiquetaOSDataUrl(
  opts: EtiquetaOSOpts & {
    qrDataUrl?: string | null;
    formato?: FormatoEtiquetaOS;
  },
): Promise<string> {
  const formato = opts.formato ?? "dupla";
  if (formato === "pequena") {
    return renderEtiquetaOSPequenaDataUrl(opts);
  }

  const spec = SPECS[formato];
  /** Escala tipográfica relativa ao layout base (100mm de largura). */
  const scale = spec.larguraMm / SPECS.dupla.larguraMm;
  const u = (n: number) => Math.max(1, Math.round(n * scale));

  const W = Math.round(spec.larguraMm * PX_POR_MM);
  const H = Math.round(spec.alturaViaMm * PX_POR_MM);
  const m = Math.round(spec.margemMm * PX_POR_MM);
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

  const gap = u(2 * PX_POR_MM);
  const qrCol = u(24 * PX_POR_MM);
  const qrSize = u(22 * PX_POR_MM);
  const leftW = contentW - qrCol - gap;

  // —— Cabeçalho esquerdo (clipado para não invadir o QR) ——
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, leftW, contentH);
  ctx.clip();

  let y = 0;
  ctx.fillStyle = "#111111";
  ctx.textBaseline = "top";
  ctx.font = `900 ${u(48)}px Arial Black, Arial, Helvetica, sans-serif`;
  const osNum = quebrarLinhas(ctx, opts.numero, leftW, 1)[0] ?? opts.numero;
  ctx.fillText(osNum, 0, y);
  y += u(52);

  ctx.fillStyle = "#444444";
  ctx.font = `400 ${u(17)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Comprovante de entrada", 0, y);
  y += u(26);

  ctx.fillStyle = "#111111";
  ctx.font = `600 ${u(20)}px Arial, Helvetica, sans-serif`;
  const metaLinhas = [cliente, bike, ...(codigo ? [codigo] : [])];
  for (const linha of metaLinhas) {
    for (const t of quebrarLinhas(ctx, linha, leftW, 1)) {
      ctx.fillText(t, 0, y);
      y += u(24);
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

  const headerBottom = Math.max(y, qrSize) + u(6);

  // Linha divisória
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1, scale * 1.5);
  ctx.beginPath();
  ctx.moveTo(0, headerBottom);
  ctx.lineTo(contentW, headerBottom);
  ctx.stroke();

  // Datas em uma única linha
  const datesY = headerBottom + u(8);
  ctx.textBaseline = "top";
  // ▶ = chegou na oficina; ⏱ = prazo à frente
  const sep = "   ";
  const parteEntrada = `▶ Entrada ${entrada}`;
  const partePrevisto = `⏱ Previsto ${prevista}`;
  const linhaDatas = `${parteEntrada}${sep}${partePrevisto}`;

  let fontSize = u(19);
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  while (fontSize > u(12) && ctx.measureText(linhaDatas).width > contentW) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  }

  ctx.fillStyle = "#111111";
  let dx = 0;
  ctx.fillText(parteEntrada, dx, datesY);
  dx += ctx.measureText(parteEntrada).width + ctx.measureText(sep).width;
  ctx.fillText(partePrevisto, dx, datesY);

  const dividerY = datesY + fontSize + u(10);
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, dividerY);
  ctx.lineTo(contentW, dividerY);
  ctx.stroke();

  // Corpo
  let by = dividerY + u(10);
  const footerH = u(44);
  const obsText =
    "Acompanhe a evolução da sua OS em biketime.com.br, fazendo login com seu e-mail e senha. Se ainda não tiver acesso, solicite na oficina.";

  const problemaLabel = u(16);
  const problemaText = u(22);
  const problemaLH = u(26);
  const checkLabel = u(15);
  const checkText = u(19);
  const checkLH = u(23);
  const obsLabel = u(14);
  const obsTextSize = u(17);
  const obsLH = u(21);
  const gapBlocos = u(14);

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
    by += labelSize + u(5);
    ctx.fillStyle = "#111111";
    ctx.font = `500 ${textSize}px Arial, Helvetica, sans-serif`;
    const linhas = quebrarLinhas(ctx, text, contentW, maxLines);
    for (const ln of linhas) {
      if (by >= contentH - footerH - lineH) break;
      ctx.fillText(ln, 0, by);
      by += lineH;
    }
  };

  const checkLines = formato === "simples" ? 1 : 2;
  const obsLines = formato === "simples" ? 2 : 2;
  const checkReserve = checkLabel + u(5) + checkLH * checkLines + gapBlocos;
  const obsReserve = obsLabel + u(5) + obsLH * obsLines + gapBlocos;
  const problemaAvail = contentH - footerH - by - checkReserve - obsReserve;
  const problemaLines = Math.max(
    2,
    Math.floor((problemaAvail - problemaLabel - u(5)) / problemaLH),
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

  // Rodapé centralizado
  ctx.strokeStyle = "#cccccc";
  ctx.beginPath();
  ctx.moveTo(0, contentH - footerH);
  ctx.lineTo(contentW, contentH - footerH);
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  const footerCx = contentW / 2;
  ctx.font = `600 ${u(16)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("www.biketime.com.br", footerCx, contentH - footerH + u(6));
  ctx.font = `600 ${u(15)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("It's Bike Time!", footerCx, contentH - footerH + u(24));
  ctx.textAlign = "left";

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Imprime a etiqueta no formato pedido
 * (dupla coluna, simples 1 via, pequena 2 vias em linha 82×25 com gap 2mm).
 */
export function imprimirEtiquetaOS(
  dataUrl: string,
  formato: FormatoEtiquetaOS = "dupla",
) {
  const spec = SPECS[formato];
  const folhaW = spec.folhaLarguraMm;
  const folhaH = spec.folhaAlturaMm;
  const viaW = spec.larguraMm;
  const viaH = spec.alturaViaMm;
  const vias = spec.vias;
  const gapMm = spec.gapMm;
  const flexDir = spec.layout === "linha" ? "row" : "column";

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
      size: ${folhaW}mm ${folhaH}mm;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${folhaW}mm;
      height: ${folhaH}mm;
      overflow: hidden;
      background: #fff;
    }
    .folha {
      width: ${folhaW}mm;
      height: ${folhaH}mm;
      display: flex;
      flex-direction: ${flexDir};
      gap: ${gapMm}mm;
    }
    .via {
      width: ${viaW}mm;
      height: ${viaH}mm;
      overflow: hidden;
      flex: 0 0 ${spec.layout === "linha" ? `${viaW}mm` : `${viaH}mm`};
    }
    .via img {
      display: block;
      width: ${viaW}mm;
      height: ${viaH}mm;
      max-width: ${viaW}mm;
      max-height: ${viaH}mm;
      border: 0;
    }
    @media print {
      html, body, .folha {
        width: ${folhaW}mm !important;
        height: ${folhaH}mm !important;
      }
      .via, .via img {
        width: ${viaW}mm !important;
        height: ${viaH}mm !important;
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
  opts: EtiquetaOSOpts & {
    qrDataUrl?: string | null;
    formato?: FormatoEtiquetaOS;
  },
) {
  const formato = opts.formato ?? "dupla";
  const dataUrl = await renderEtiquetaOSDataUrl({ ...opts, formato });
  imprimirEtiquetaOS(dataUrl, formato);
}
