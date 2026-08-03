import qz from "qz-tray";

const LS_PRINTER = "bt-gestao-zpl-printer";

export type QzPrintResult =
  | { ok: true; printer: string }
  | { ok: false; reason: "no_qz" | "no_printer" | "error"; message: string };

let securityConfigured = false;

/**
 * Configura segurança permissiva (intranet).
 * No QZ Tray: Site Manager → permitir este site (unsigned).
 */
function configureQzSecurity() {
  if (securityConfigured) return;
  securityConfigured = true;

  qz.security.setCertificatePromise((resolve) => {
    resolve();
  });
  qz.security.setSignaturePromise(() => (resolve) => {
    resolve();
  });
}

/**
 * Conecta ao QZ Tray (necessário instalado e em execução no PC da oficina).
 */
async function ensureQzConnected(): Promise<void> {
  configureQzSecurity();
  if (qz.websocket.isActive()) return;
  await qz.websocket.connect({
    retries: 2,
    delay: 1,
  });
}

/**
 * Lista impressoras disponíveis via QZ Tray.
 */
export async function listarImpressorasQz(): Promise<string[]> {
  await ensureQzConnected();
  const found = await qz.printers.find();
  return Array.isArray(found) ? found : found ? [String(found)] : [];
}

/**
 * Impressora preferida salva no navegador (localStorage).
 */
export function getImpressoraZplPreferida(): string | null {
  try {
    return localStorage.getItem(LS_PRINTER);
  } catch {
    return null;
  }
}

/**
 * Persiste impressora preferida para próximos jobs ZPL.
 */
export function setImpressoraZplPreferida(nome: string) {
  try {
    localStorage.setItem(LS_PRINTER, nome);
  } catch {
    /* ignore */
  }
}

/**
 * Envia ZPL cru para a impressora térmica (Elgin L42 etc.) via QZ Tray.
 */
export async function imprimirZplViaQz(
  zpl: string,
  printerName?: string | null,
): Promise<QzPrintResult> {
  try {
    await ensureQzConnected();
  } catch {
    return {
      ok: false,
      reason: "no_qz",
      message:
        "QZ Tray não está disponível. Instale e abra o QZ Tray (https://qz.io/download), confie neste site no Site Manager e tente de novo.",
    };
  }

  try {
    let printer = (printerName || getImpressoraZplPreferida() || "").trim();
    if (!printer) {
      const list = await listarImpressorasQz();
      printer =
        list.find((p) => /elgin|l42|zebra|zpl|thermal|térmica/i.test(p)) ??
        list[0] ??
        "";
    }
    if (!printer) {
      return {
        ok: false,
        reason: "no_printer",
        message: "Nenhuma impressora encontrada pelo QZ Tray.",
      };
    }

    setImpressoraZplPreferida(printer);

    const config = qz.configs.create(printer, {
      encoding: "UTF-8",
      forceRaw: true,
    });

    await qz.print(config, [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: zpl,
      },
    ]);

    return { ok: true, printer };
  } catch (e) {
    return {
      ok: false,
      reason: "error",
      message: e instanceof Error ? e.message : "Falha ao enviar ZPL à impressora",
    };
  }
}
