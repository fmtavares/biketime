import QRCode from "qrcode";
import logoUrl from "@/assets/biketime-logo.png";

/** URL pública do QR no site (cliente nunca vê link da gestão). */
export const SITE_BIKE_QR_ORIGIN = "https://biketime.com.br";

/** Monta a URL canônica do adesivo/QR da bike. */
export function urlQrBike(codigoBike: string) {
  return `${SITE_BIKE_QR_ORIGIN}/b/${encodeURIComponent(codigoBike)}`;
}

export type AdesivoBikeOpts = {
  codigoBike: string;
  marca: string;
  modelo: string;
  clienteNome?: string | null;
};

/**
 * Carrega uma imagem (URL ou data URL) para uso em canvas.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem do adesivo"));
    img.src = src;
  });
}

/**
 * Desenha a logo em tons de cinza/preto no canvas (bom para impressão).
 */
function drawLogoPb(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const pad = Math.round(size * 0.12);
  const box = size + pad * 2;

  // Fundo branco arredondado para preservar legibilidade do QR
  ctx.fillStyle = "#ffffff";
  const r = Math.round(box * 0.18);
  const bx = x - pad;
  const by = y - pad;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + box, by, bx + box, by + box, r);
  ctx.arcTo(bx + box, by + box, bx, by + box, r);
  ctx.arcTo(bx, by + box, bx, by, r);
  ctx.arcTo(bx, by, bx + box, by, r);
  ctx.closePath();
  ctx.fill();

  // Desenha logo e converte para P&B na área
  ctx.drawImage(logo, x, y, size, size);
  const imgData = ctx.getImageData(x, y, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 16) continue;
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    // Empurra para preto/branco (impressão limpa)
    const v = g > 170 ? 255 : 20;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imgData, x, y);
}

/**
 * Gera QR com logo BikeTime pequena no centro (P&B), correção alta.
 */
export async function gerarQrDataUrl(codigoBike: string): Promise<string> {
  const size = 360;
  const qrDataUrl = await QRCode.toDataURL(urlQrBike(codigoBike), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#111111", light: "#ffffff" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, size, size);

  const logo = await loadImage(logoUrl);
  // ~16% do QR — cabe na correção H sem atrapalhar o scan
  const logoSize = Math.round(size * 0.16);
  const lx = Math.round((size - logoSize) / 2);
  const ly = Math.round((size - logoSize) / 2);
  drawLogoPb(ctx, logo, lx, ly, logoSize);

  return canvas.toDataURL("image/png");
}

/**
 * Imprime o adesivo via iframe oculto (sem popup / nova aba).
 */
export function imprimirAdesivoHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.body.removeChild(iframe);
    throw new Error("Não foi possível preparar a impressão.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* ignore */
    }
  };

  const trigger = () => {
    try {
      win.focus();
      win.print();
    } finally {
      window.setTimeout(cleanup, 1000);
    }
  };

  window.setTimeout(trigger, 250);
}

/**
 * Monta o HTML do adesivo para preview/impressão (sem texto da marca).
 */
export function htmlAdesivoBike(opts: AdesivoBikeOpts & { qrDataUrl: string }) {
  const titulo = `${opts.marca} ${opts.modelo}`.trim();
  const cliente = (opts.clienteNome ?? "").trim();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Adesivo ${opts.codigoBike}</title>
  <style>
    @page { size: 35mm 40mm; margin: 1mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #fff;
      color: #111;
    }
    .label {
      width: 33mm;
      text-align: center;
      padding: 0.5mm;
      line-height: 1.05;
    }
    img.qr {
      width: 22mm;
      height: 22mm;
      display: block;
      margin: 0 auto 0.6mm;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      line-height: 1.1;
    }
    .bike {
      margin-top: 0.3mm;
      font-size: 6.5pt;
      line-height: 1.1;
    }
    .cliente {
      margin-top: 0.2mm;
      font-size: 6pt;
      line-height: 1.1;
      color: #444;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media print {
      body { min-height: auto; }
    }
  </style>
</head>
<body>
  <div class="label">
    <img class="qr" src="${opts.qrDataUrl}" alt="QR ${opts.codigoBike}" />
    <div class="code">${opts.codigoBike}</div>
    <div class="bike">${titulo}</div>
    ${cliente ? `<div class="cliente">${cliente}</div>` : ""}
  </div>
</body>
</html>`;
}
