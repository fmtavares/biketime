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
 * Limita texto longo para caber na etiqueta 80×50mm.
 */
function truncar(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
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
 * Imprime a etiqueta 80×50mm via iframe oculto.
 */
export function imprimirEtiquetaOS(html: string) {
  imprimirAdesivoHtml(html);
}

/**
 * Monta o HTML do comprovante de entrada da OS — 80mm × 50mm, margem 2mm.
 * Área útil: 76mm × 46mm.
 */
export function htmlEtiquetaOS(
  opts: EtiquetaOSOpts & { qrDataUrl?: string | null },
) {
  const bike = tituloBikeEtiqueta(opts);
  const cliente = truncar((opts.clienteNome ?? "").trim() || "—", 28);
  const problema = truncar((opts.problemaRelatado ?? "").trim() || "—", 90);
  const checklist = truncar(textoChecklistEtiqueta(opts.checklistEntrada), 70);
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
      size: 80mm 50mm;
      margin: 2mm;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      height: 50mm;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      color: #111;
      background: #fff;
      font-size: 6.5pt;
      line-height: 1.15;
      overflow: hidden;
    }
    .sheet {
      width: 76mm;
      height: 46mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 2mm;
    }
    .brand {
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1;
    }
    .subtitle {
      font-size: 5.5pt;
      color: #555;
      white-space: nowrap;
    }
    .top {
      display: flex;
      gap: 2mm;
      align-items: flex-start;
      justify-content: space-between;
      margin-top: 1mm;
      padding-bottom: 1mm;
      border-bottom: 0.3mm solid #111;
      min-height: 0;
    }
    .top-text { min-width: 0; flex: 1; }
    .os {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1;
    }
    .meta {
      margin-top: 0.6mm;
      font-size: 6pt;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta strong { font-weight: 700; }
    img.qr {
      width: 16mm;
      height: 16mm;
      display: block;
      flex-shrink: 0;
    }
    .dates {
      display: flex;
      gap: 2mm;
      margin-top: 1mm;
    }
    .dates > div { flex: 1; min-width: 0; }
    .label {
      font-size: 5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #555;
      margin-bottom: 0.2mm;
    }
    .block { margin-top: 0.8mm; min-height: 0; }
    .text {
      font-size: 6pt;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: hidden;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      max-height: 3.2em;
    }
    .footer {
      margin-top: auto;
      padding-top: 0.6mm;
      border-top: 0.25mm solid #ccc;
      font-size: 5pt;
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
    <div class="head">
      <div class="brand">BikeTime</div>
      <div class="subtitle">Comprovante de entrada</div>
    </div>

    <div class="top">
      <div class="top-text">
        <div class="os">${esc(opts.numero)}</div>
        <div class="meta"><strong>Cliente:</strong> ${esc(cliente)}</div>
        <div class="meta"><strong>Bike:</strong> ${esc(truncar(bike, 32))}</div>
        ${
          codigo
            ? `<div class="meta"><strong>Cód:</strong> ${esc(codigo)}</div>`
            : ""
        }
      </div>
      ${
        qr
          ? `<img class="qr" src="${qr}" alt="QR ${esc(codigo || opts.numero)}" />`
          : ""
      }
    </div>

    <div class="dates">
      <div>
        <div class="label">Entrada</div>
        <div>${esc(entrada)}</div>
      </div>
      <div>
        <div class="label">Previsão</div>
        <div>${esc(prevista)}</div>
      </div>
    </div>

    <div class="block">
      <div class="label">Problema / serviço</div>
      <div class="text">${esc(problema)}</div>
    </div>

    <div class="block">
      <div class="label">Checklist / acessórios</div>
      <div class="text">${esc(checklist)}</div>
    </div>

    <div class="footer">biketime.com.br · It's Bike Time — Perdizes</div>
  </div>
</body>
</html>`;
}
