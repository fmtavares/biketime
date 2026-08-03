import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  codigo: z.string().min(3).max(32),
  /** Access token do usuário no site (opcional). */
  accessToken: z.string().optional().nullable(),
});

export type BikeQrResolve =
  | {
      kind: "owner";
      codigo: string;
      bike: {
        id: string;
        marca: string;
        modelo: string;
        ano: number | null;
        tamanho: string | null;
        cor: string | null;
        numero_serie: string | null;
      };
    }
  | {
      kind: "aviso";
      codigo: string;
    };

/**
 * Resolve o scan do QR da bike no site (público).
 * - Cliente dono logado → dados seguros da bike
 * - Demais / staff / sem login / código inválido → aviso genérico
 *   (equipe usa o scanner dentro da gestão; link da gestão nunca é exposto)
 */
export const resolveBikeQr = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<BikeQrResolve> => {
    const codigo = data.codigo.trim().toUpperCase();

    const { data: bike, error } = await (supabaseAdmin as any)
      .from("bikes")
      .select(
        "id, marca, modelo, ano, tamanho, cor, numero_serie, cliente_id, codigo_bike, clientes(id, user_id)",
      )
      .eq("codigo_bike", codigo)
      .maybeSingle();

    if (error || !bike) {
      return { kind: "aviso", codigo };
    }

    let userId: string | null = null;
    if (data.accessToken) {
      const { data: userData } = await supabaseAdmin.auth.getUser(data.accessToken);
      userId = userData.user?.id ?? null;
    }

    if (userId) {
      const ownerUserId =
        (bike.clientes as { user_id?: string | null } | null)?.user_id ?? null;
      if (ownerUserId && ownerUserId === userId) {
        return {
          kind: "owner",
          codigo,
          bike: {
            id: bike.id,
            marca: bike.marca,
            modelo: bike.modelo,
            ano: bike.ano,
            tamanho: bike.tamanho,
            cor: bike.cor,
            numero_serie: bike.numero_serie,
          },
        };
      }
    }

    return { kind: "aviso", codigo };
  });
