import { gerarQrDataUrl, imprimirAdesivoHtml } from "@/lib/bike-adesivo";

/** Texto padrão quando o checklist de entrada está vazio. */
export const CHECKLIST_ENTRADA_PADRAO =
  "Nenhum acessório deixado junto à bike (nada mencionado na entrada).";

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
 * Escapa texto para HTML seguro na etiqueta impressa.
 */
function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
 * Imprime a etiqueta 98×78mm via iframe oculto.
 */
export function imprimirEtiquetaOS(html: string) {
  imprimirAdesivoHtml(html);
}

/**
 * Monta o HTML do comprovante de entrada da OS — 98mm × 78mm, margem 2mm.
 * Área útil: 94mm × 74mm. QR alinhado no topo com o título BikeTime;
 * datas (entrada/previsão) abaixo do QR.
 */
export function htmlEtiquetaOS(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
) {
  const bike = tituloBikeEtiqueta(opts);
  const cliente = (opts.clienteNome ?? "").trim() || "—";
  const problema = (opts.problemaRelatado ?? "").trim() || "—";
  const checklist = textoChecklistEtiqueta(opts.checklistEntrada);
  const entrada = formatarDataEtiqueta(opts.dataEntrada);
  const prevista = formatarDataEtiqueta(opts.dataPrevista);
  const codigo = (opts.codigoBike ?? "").trim();
  const qr = opts.qrDataUrl;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante ${esc(opts.numero)}</title>
  <style>
    @page {
      size: 98mm 78mm;
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 98mm;
      height: 78mm;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #111;
      background: #fff;
      font-size: 7.5pt;
      line-height: 1.2;
      overflow: hidden;
    }
    .sheet {
      width: 94mm;
      height: 74mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      display: flex;
      gap: 2.5mm;
      align-items: flex-start;
      justify-content: space-between;
      padding-bottom: 1.5mm;
      border-bottom: 0.3mm solid #111;
    }
    .header-text { min-width: 0; flex: 1; }
    .header-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 22mm;
    }
    .brand {
      font-size: 11pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1.1;
      margin: 0;
    }
    .subtitle {
      margin-top: 0.6mm;
      font-size: 7pt;
      color: #444;
    }
    .os {
      margin-top: 1.5mm;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1.1;
      word-break: break-word;
    }
    .meta {
      margin-top: 0.8mm;
      font-size: 7pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta strong { font-weight: 700; }
    img.qr {
      width: 20mm;
      height: 20mm;
      display: block;
      margin: 0;
    }
    .dates {
      width: 100%;
      margin-top: 1mm;
      text-align: center;
    }
    .dates .date-row { margin-top: 0.7mm; }
    .dates .date-row:first-child { margin-top: 0; }
    .label {
      font-size: 5.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
      margin-bottom: 0.2mm;
    }
    .date-val { font-size: 6.5pt; line-height: 1.1; }
    .body {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      margin-top: 1.5mm;
    }
    .block { margin-top: 1.4mm; min-height: 0; flex: 1; }
    .block:first-child { margin-top: 0; }
    .text {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 7pt;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      line-clamp: 4;
    }
    .footer {
      margin-top: auto;
      padding-top: 1mm;
      border-top: 0.25mm solid #ccc;
      font-size: 5.5pt;
      color: #333;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="header-text">
        <div class="brand">BikeTime</div>
        <div class="subtitle">Comprovante de entrada</div>
        <div class="os">${esc(opts.numero)}</div>
        <div class="meta"><strong>Cliente:</strong> ${esc(cliente)}</div>
        <div class="meta"><strong>Bike:</strong> ${esc(bike)}</div>
        ${
          codigo
            ? `<div class="meta"><strong>Código:</strong> ${esc(codigo)}</div>`
            : ""
        }
      </div>
      <div class="header-side">
        ${
          qr
            ? `<img class="qr" src="${qr}" alt="QR ${esc(codigo || opts.numero)}" />`
            : ""
        }
        <div class="dates">
          <div class="date-row">
            <div class="label">Entrada</div>
            <div class="date-val">${esc(entrada)}</div>
          </div>
          <div class="date-row">
            <div class="label">Previsão</div>
            <div class="date-val">${esc(prevista)}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="block">
        <div class="label">Problema / serviço</div>
        <div class="text">${esc(problema)}</div>
      </div>
      <div class="block">
        <div class="label">Checklist / acessórios</div>
        <div class="text">${esc(checklist)}</div>
      </div>
    </div>

    <div class="footer">biketime.com.br · It's Bike Time — Perdizes</div>
  </div>
</body>
</html>`;
}
