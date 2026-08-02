/**
 * Helpers e chamada da Edge Function de NFS-e (Focus NFe).
 */
import { supabase } from "@/integrations/supabase/client";

export type NfseOsFields = {
  nfse_ref?: string | null;
  nfse_status?: string | null;
  nfse_numero?: string | null;
  nfse_codigo_verificacao?: string | null;
  nfse_url_pdf?: string | null;
  nfse_url_xml?: string | null;
  nfse_erro?: string | null;
  nfse_numero_rps?: string | null;
  nfse_emitida_em?: string | null;
};

/**
 * Rótulo amigável do status retornado pela Focus.
 */
export function labelNfseStatus(status: string | null | undefined): string {
  switch (status) {
    case "autorizado":
      return "Autorizada";
    case "processando_autorizacao":
      return "Processando…";
    case "erro_autorizacao":
    case "erro":
      return "Erro na autorização";
    case "cancelado":
      return "Cancelada";
    default:
      return status ? status.replace(/_/g, " ") : "—";
  }
}

/**
 * Indica se o CTA de emitir deve aparecer (OS paga e ainda sem nota válida).
 */
export function podeEmitirNfse(os: {
  id?: string;
  status?: string;
  nfse_status?: string | null;
  nfse_url_pdf?: string | null;
}): boolean {
  if (!os?.id || os.status !== "pago") return false;
  if (os.nfse_status === "autorizado" && os.nfse_url_pdf) return false;
  if (os.nfse_status === "processando_autorizacao") return false;
  return true;
}

/**
 * Chama a Edge Function emitir-nfse (emitir ou consultar).
 */
export async function invocarNfse(
  action: "emitir" | "consultar",
  osId: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase.functions.invoke("emitir-nfse", {
    body: { action, os_id: osId },
  });
  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const body = (await ctx.json()) as { error?: string; os?: unknown };
        if (body?.error) return { data: body, error: String(body.error) };
      } catch {
        /* ignora parse */
      }
    }
    return { data: data ?? null, error: error.message };
  }
  if (data?.error) {
    return { data, error: String(data.error) };
  }
  return { data, error: null };
}
