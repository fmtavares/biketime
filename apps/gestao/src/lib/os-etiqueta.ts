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
 * Imprime a etiqueta A6 via iframe oculto (mesmo motor do adesivo).
 */
export function imprimirEtiquetaOS(html: string) {
  imprimirAdesivoHtml(html);
}

/**
 * Monta o HTML A6 do comprovante de entrada da OS.
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
    @page { size: A6; margin: 6mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      color: #111;
      background: #fff;
      font-size: 9pt;
      line-height: 1.25;
    }
    .sheet {
      width: 100%;
      min-height: calc(148mm - 12mm);
      display: flex;
      flex-direction: column;
    }
    .brand {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: 0.02em;
      line-height: 1.1;
    }
    .subtitle {
      margin-top: 1mm;
      font-size: 8.5pt;
      color: #444;
    }
    .top {
      display: flex;
      gap: 4mm;
      align-items: flex-start;
      justify-content: space-between;
      margin-top: 3mm;
      padding-bottom: 2.5mm;
      border-bottom: 0.4mm solid #111;
    }
    .os {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: 0.03em;
      line-height: 1.1;
    }
    .meta { margin-top: 1.5mm; font-size: 8.5pt; }
    .meta strong { font-weight: 700; }
    img.qr {
      width: 28mm;
      height: 28mm;
      display: block;
      flex-shrink: 0;
    }
    .block { margin-top: 2.5mm; }
    .label {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
      margin-bottom: 0.6mm;
    }
    .text {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 8.5pt;
    }
    .dates {
      display: flex;
      gap: 4mm;
      margin-top: 2.5mm;
    }
    .dates > div { flex: 1; }
    .footer {
      margin-top: auto;
      padding-top: 3mm;
      border-top: 0.3mm solid #ccc;
      font-size: 7pt;
      color: #333;
      line-height: 1.35;
    }
    .footer .tagline {
      margin-top: 1.2mm;
      font-weight: 700;
      color: #111;
      font-style: italic;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">BikeTime</div>
    <div class="subtitle">Comprovante de entrada</div>

    <div class="top">
      <div>
        <div class="os">${esc(opts.numero)}</div>
        <div class="meta"><strong>Cliente:</strong> ${esc(cliente)}</div>
        <div class="meta"><strong>Bike:</strong> ${esc(bike)}</div>
        ${
          codigo
            ? `<div class="meta"><strong>Código:</strong> ${esc(codigo)}</div>`
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

    <div class="footer">
      <div>
        Acompanhe a jornada da sua bike: acesse biketime.com.br, faça login com seu e-mail
        e veja o status na oficina.
      </div>
      <div class="tagline">It's Bike Time, sua oficina premium em Perdizes.</div>
    </div>
  </div>
</body>
</html>`;
}
