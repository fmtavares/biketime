import { supabase } from "@/integrations/supabase/client";

export type PasskeyItem = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};

/**
 * Confere se o usuário Auth está ligado a um registro em `clientes`.
 */
export async function clienteVinculado(userId: string): Promise<boolean> {
  const { data } = await (supabase as any)
    .from("clientes")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Traduz erros de passkey/WebAuthn para mensagem amigável.
 */
export function msgErroPasskey(error: { message?: string; code?: string } | null | undefined): string {
  const code = error?.code ?? "";
  const raw = (error?.message ?? "").toLowerCase();

  if (code === "passkey_disabled") {
    return "Login biométrico ainda não está liberado. Ative Passkeys no Supabase (Authentication → Passkeys).";
  }
  if (code === "webauthn_credential_not_found") {
    return "Nenhuma biometria cadastrada para esta conta. Entre com senha e ative em Minha conta.";
  }
  if (code === "webauthn_credential_exists") {
    return "Esta biometria já está cadastrada nesta conta.";
  }
  if (code === "too_many_passkeys") {
    return "Limite de biometrias atingido. Remova uma em Minha conta.";
  }
  if (raw.includes("cancel") || raw.includes("not allowed") || raw.includes("abort")) {
    return "Operação cancelada.";
  }
  return error?.message || "Não foi possível usar a biometria.";
}

/** Lista passkeys do usuário logado. */
export async function listarPasskeys(): Promise<{ data: PasskeyItem[]; error: Error | null }> {
  const { data, error } = await supabase.auth.passkey.list();
  return {
    data: (data as PasskeyItem[] | null) ?? [],
    error: error as Error | null,
  };
}

/** Registra Face ID / biometria do dispositivo para o usuário logado. */
export async function registrarPasskey() {
  return supabase.auth.registerPasskey();
}

/** Login com passkey (Face ID / biometria), sem e-mail na tela. */
export async function entrarComPasskey() {
  return supabase.auth.signInWithPasskey();
}

/** Remove uma passkey do usuário logado. */
export async function removerPasskey(passkeyId: string) {
  return supabase.auth.passkey.delete({ passkeyId });
}
