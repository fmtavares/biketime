import { supabase } from "@/integrations/supabase/client";

/**
 * Contas sistêmicas: não entram em selects de equipe (oficina, execução, etc.).
 */
export const EMAILS_USUARIOS_SISTEMA = [
  "contato@biketime.com.br",
  "admin@admin.com.br",
] as const;

const SET_SISTEMA = new Set(
  EMAILS_USUARIOS_SISTEMA.map((e) => e.toLowerCase()),
);

export type ProfileEquipe = {
  id: string;
  full_name: string | null;
  email: string | null;
};

/**
 * Indica se o e-mail é de usuário sistêmico (fora do time operacional).
 */
export function isUsuarioSistema(email: string | null | undefined): boolean {
  if (!email) return false;
  return SET_SISTEMA.has(email.trim().toLowerCase());
}

/**
 * Remove usuários sistêmicos da lista usada em selects da oficina/equipe.
 */
export function filtrarUsuariosEquipe<T extends { email?: string | null }>(
  users: T[],
): T[] {
  return users.filter((u) => !isUsuarioSistema(u.email));
}

/**
 * Carrega só profiles com papel de gestão/oficina (admin, vendedor, técnico).
 * Exclui clientes do portal e contas sistêmicas.
 */
export async function listarUsuariosEquipe(): Promise<ProfileEquipe[]> {
  const { data, error } = await (supabase as any).rpc("listar_profiles_equipe");
  if (error) {
    console.error("listar_profiles_equipe:", error.message);
    return [];
  }
  return filtrarUsuariosEquipe((data as ProfileEquipe[]) ?? []);
}
