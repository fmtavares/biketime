import { urlQrOs } from "@/lib/bike-adesivo";
import {
  formatarDataEtiquetaCurta,
  tituloBikeEtiqueta,
  type EtiquetaOSOpts,
  type FormatoEtiquetaOS,
} from "@/lib/os-etiqueta";

/** Resolução nativa da Elgin L42 Pro (203 dpi). */
export const ZPL_DPI = 203;

/** Converte milímetros em dots a 203 dpi. */
export function mmToDots(mm: number): number {
  return Math.round((mm * ZPL_DPI) / 25.4);
}

/**
 * Escapa texto para campo ^FD do ZPL (remove controles e limita tamanho).
 */
function zplText(raw: string, maxLen = 48): string {
  return (raw ?? "")
    .replace(/[\^~\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Desenha uma via da OS pequena (40×25 mm) em origem (ox, oy) dots.
 * QR nativo ^BQ — dimensionado para caber na via sem estourar a direita;
 * textos à esquerda com ^FB para não invadir o QR.
 */
function zplViaPequena(
  opts: EtiquetaOSOpts,
  ox: number,
  oy: number,
): string {
  const m = mmToDots(1);
  const viaW = mmToDots(40);
  const gapTxtQr = mmToDots(1);

  /**
   * Magnificação 4: URL típica (~v4, ~33 módulos) ≈ 132 dots (~16,5 mm),
   * cabe na via com margem 1 mm sem estourar a direita.
   */
  const qrMag = 4;
  const qrModulesEst = 35; // folga acima do típico para a URL /os/...
  const qrDots = qrModulesEst * qrMag;
  const qrFoX = ox + viaW - m - qrDots;
  const qrFoY = oy + m;

  const x = ox + m;
  /** Largura máxima da coluna de texto (corta antes do QR). */
  const textW = Math.max(40, qrFoX - x - gapTxtQr);

  const numero = zplText(opts.numero, 16);
  const cliente = zplText(opts.clienteNome || "—", 40);
  const bike = zplText(tituloBikeEtiqueta(opts), 40);
  const entrada = formatarDataEtiquetaCurta(opts.dataEntrada);
  const prevista = formatarDataEtiquetaCurta(opts.dataPrevista);
  const qrUrl = urlQrOs(opts.numero);

  let y = oy + m + mmToDots(1.2);

  /** Campo de texto com largura limitada (não invade o QR). */
  const fb = (yy: number, h: number, text: string) =>
    `^FO${x},${yy}^A0N,${h},${h}^FB${textW},1,0,L,0^FD${text}^FS`;

  const lines: string[] = [];
  lines.push(fb(y, 28, numero));
  y += 32;
  lines.push(fb(y, 18, cliente));
  y += 22;
  lines.push(fb(y, 18, bike));
  y += 28;
  lines.push(fb(y, 16, `> Entrada ${entrada}`));
  y += 20;
  lines.push(fb(y, 16, `# Previsto ${prevista}`));
  lines.push(
    `^FO${qrFoX},${qrFoY}^BQN,2,${qrMag}^FDQA,${zplText(qrUrl, 200)}^FS`,
  );
  return lines.join("\n");
}

/**
 * Gera ZPL da OS pequena: 2 vias 40×25 na mesma linha, gap central 2 mm.
 * Folha 82×25 mm @ 203 dpi (Elgin L42).
 */
export function gerarZplEtiquetaPequena(opts: EtiquetaOSOpts): string {
  const folhaW = mmToDots(82);
  const folhaH = mmToDots(25);
  const viaW = mmToDots(40);
  const gap = mmToDots(2);

  const via1 = zplViaPequena(opts, 0, 0);
  const via2 = zplViaPequena(opts, viaW + gap, 0);

  return [
    "^XA",
    "^CI28", // UTF-8 (acentos em nomes)
    `^PW${folhaW}`,
    `^LL${folhaH}`,
    "^LH0,0",
    "^MD15", // densidade média-alta (0–30 na Elgin)
    via1,
    via2,
    "^PQ1,0,1,Y",
    "^XZ",
  ].join("\n");
}

/**
 * Gera ZPL da OS simples (78×70 mm, 1 via).
 */
export function gerarZplEtiquetaSimples(opts: EtiquetaOSOpts): string {
  const W = mmToDots(78);
  const H = mmToDots(70);
  const m = mmToDots(2);
  const numero = zplText(opts.numero, 24);
  const cliente = zplText(opts.clienteNome || "—", 40);
  const bike = zplText(tituloBikeEtiqueta(opts), 40);
  const codigo = zplText(opts.codigoBike ?? "", 24);
  const entrada = formatarDataEtiquetaCurta(opts.dataEntrada);
  const prevista = formatarDataEtiquetaCurta(opts.dataPrevista);
  const problema = zplText(opts.problemaRelatado || "—", 80);
  const qrUrl = urlQrOs(opts.numero);

  return [
    "^XA",
    "^CI28",
    `^PW${W}`,
    `^LL${H}`,
    "^LH0,0",
    "^MD15",
    `^FO${m},${m}^A0N,48,48^FD${numero}^FS`,
    `^FO${m},${m + 56}^A0N,26,26^FD${cliente}^FS`,
    `^FO${m},${m + 86}^A0N,26,26^FD${bike}^FS`,
    codigo
      ? `^FO${m},${m + 116}^A0N,24,24^FD${codigo}^FS`
      : "",
    `^FO${m},${m + 150}^A0N,24,24^FD> Entrada ${entrada}   # Previsto ${prevista}^FS`,
    `^FO${m},${m + 190}^A0N,20,20^FDPROBLEMA / SERVICO^FS`,
    `^FO${m},${m + 214}^A0N,24,24^FD${problema}^FS`,
    `^FO${W - m - mmToDots(22)},${m}^BQN,2,5^FDQA,${zplText(qrUrl, 200)}^FS`,
    `^FO${m},${H - m - 40}^A0N,20,20^FDwww.biketime.com.br^FS`,
    `^FO${m},${H - m - 18}^A0N,18,18^FDIt's Bike Time!^FS`,
    "^PQ1,0,1,Y",
    "^XZ",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Gera ZPL da OS dupla (2 vias 100×75 empilhadas = folha 100×150).
 */
export function gerarZplEtiquetaDupla(opts: EtiquetaOSOpts): string {
  const viaW = mmToDots(100);
  const viaH = mmToDots(75);
  const m = mmToDots(2);

  const drawVia = (oy: number) => {
    const numero = zplText(opts.numero, 24);
    const cliente = zplText(opts.clienteNome || "—", 42);
    const bike = zplText(tituloBikeEtiqueta(opts), 42);
    const codigo = zplText(opts.codigoBike ?? "", 24);
    const entrada = formatarDataEtiquetaCurta(opts.dataEntrada);
    const prevista = formatarDataEtiquetaCurta(opts.dataPrevista);
    const problema = zplText(opts.problemaRelatado || "—", 90);
    const qrUrl = urlQrOs(opts.numero);
    return [
      `^FO${m},${oy + m}^A0N,52,52^FD${numero}^FS`,
      `^FO${m},${oy + m + 58}^A0N,28,28^FD${cliente}^FS`,
      `^FO${m},${oy + m + 90}^A0N,28,28^FD${bike}^FS`,
      codigo ? `^FO${m},${oy + m + 122}^A0N,24,24^FD${codigo}^FS` : "",
      `^FO${m},${oy + m + 160}^A0N,26,26^FD> Entrada ${entrada}   # Previsto ${prevista}^FS`,
      `^FO${m},${oy + m + 200}^A0N,20,20^FDPROBLEMA / SERVICO^FS`,
      `^FO${m},${oy + m + 224}^A0N,26,26^FD${problema}^FS`,
      `^FO${viaW - m - mmToDots(24)},${oy + m}^BQN,2,6^FDQA,${zplText(qrUrl, 200)}^FS`,
      `^FO${m},${oy + viaH - m - 44}^A0N,22,22^FDwww.biketime.com.br^FS`,
      `^FO${m},${oy + viaH - m - 20}^A0N,20,20^FDIt's Bike Time!^FS`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  return [
    "^XA",
    "^CI28",
    `^PW${viaW}`,
    `^LL${viaH * 2}`,
    "^LH0,0",
    "^MD15",
    drawVia(0),
    drawVia(viaH),
    "^PQ1,0,1,Y",
    "^XZ",
  ].join("\n");
}

/**
 * Gera o ZPL do formato pedido.
 */
export function gerarZplEtiquetaOS(
  opts: EtiquetaOSOpts,
  formato: FormatoEtiquetaOS,
): string {
  if (formato === "pequena") return gerarZplEtiquetaPequena(opts);
  if (formato === "simples") return gerarZplEtiquetaSimples(opts);
  return gerarZplEtiquetaDupla(opts);
}

/**
 * Baixa o arquivo .zpl para envio manual (utilitário Elgin / Zebra).
 */
export function baixarArquivoZpl(zpl: string, nomeArquivo: string) {
  const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo.endsWith(".zpl") ? nomeArquivo : `${nomeArquivo}.zpl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
