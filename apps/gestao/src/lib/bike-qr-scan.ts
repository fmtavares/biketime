/**
 * Alvo interpretado a partir do texto do QR (adesivo bike ou etiqueta OS).
 */
export type QrScanTarget =
  | { kind: "bike"; codigo: string }
  | { kind: "os"; numero: string };

/**
 * Extrai bike ou OS a partir do texto lido no QR.
 * Aceita URLs `/b/CODIGO`, `/os/NUMERO` ou código cru de bike.
 */
export function interpretarQrScan(raw: string): QrScanTarget | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const fromPath = (pathname: string): QrScanTarget | null => {
    const os = pathname.match(/\/os\/([^/]+)\/?$/i);
    if (os?.[1]) {
      const numero = decodeURIComponent(os[1]).trim().toUpperCase();
      return numero ? { kind: "os", numero } : null;
    }
    const bike = pathname.match(/\/b\/([^/]+)\/?$/i);
    if (bike?.[1]) {
      const codigo = decodeURIComponent(bike[1]).trim().toUpperCase();
      return codigo ? { kind: "bike", codigo } : null;
    }
    return null;
  };

  try {
    const url = new URL(text);
    const hit = fromPath(url.pathname);
    if (hit) return hit;
  } catch {
    /* não é URL absoluta */
  }

  const rel = fromPath(text.startsWith("/") ? text : `/${text}`);
  if (rel) return rel;

  const pathOs = text.match(/(?:^|\/)os\/([^/?#]+)/i);
  if (pathOs?.[1]) {
    const numero = decodeURIComponent(pathOs[1]).trim().toUpperCase();
    return numero ? { kind: "os", numero } : null;
  }
  const pathBike = text.match(/(?:^|\/)b\/([^/?#]+)/i);
  if (pathBike?.[1]) {
    const codigo = decodeURIComponent(pathBike[1]).trim().toUpperCase();
    return codigo ? { kind: "bike", codigo } : null;
  }

  // Número de OS cru (ex.: OS-42)
  const osRaw = text.replace(/\s+/g, "").toUpperCase();
  if (/^OS-\d+$/i.test(osRaw)) return { kind: "os", numero: osRaw };

  // Código de bike cru (ex.: BTB-00001)
  if (/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(osRaw)) {
    return { kind: "bike", codigo: osRaw };
  }

  return null;
}

/**
 * Extrai o código da bike a partir do texto lido no QR.
 * @deprecated Preferir `interpretarQrScan`.
 */
export function extrairCodigoBikeDoQr(raw: string): string | null {
  const t = interpretarQrScan(raw);
  return t?.kind === "bike" ? t.codigo : null;
}
