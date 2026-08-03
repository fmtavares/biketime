/**
 * Extrai o código da bike a partir do texto lido no QR.
 * Aceita URL pública `/b/CODIGO` ou o código cru (ex.: BTB-00001).
 */
export function extrairCodigoBikeDoQr(raw: string): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const m = url.pathname.match(/\/b\/([^/]+)\/?$/i);
    if (m?.[1]) return decodeURIComponent(m[1]).trim().toUpperCase() || null;
  } catch {
    /* não é URL absoluta — tenta path relativo ou código puro */
  }

  const pathMatch = text.match(/(?:^|\/)b\/([^/?#]+)/i);
  if (pathMatch?.[1]) {
    return decodeURIComponent(pathMatch[1]).trim().toUpperCase() || null;
  }

  const codigo = text.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(codigo)) return codigo;

  return null;
}
