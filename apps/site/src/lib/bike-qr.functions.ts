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
      kind: "staff";
      codigo: string;
      gestaoUrl: string;
    }
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

const GESTAO_ORIGIN =
  process.env.GESTAO_URL ||
  process.env.VITE_GESTAO_URL ||
  "https://gestao.biketime.com.br";

/**
 * Resolve o scan do QR da bike no site.
 * - Staff → URL da gestão
 * - Cliente dono → dados seguros da bike
 * - Demais / sem login / código inválido → aviso genérico (sem vazar existência)
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
      const { data: staff } = await (supabaseAdmin as any).rpc("is_staff", {
        _user_id: userId,
      });
      if (staff === true) {
        return {
          kind: "staff",
          codigo,
          gestaoUrl: `${GESTAO_ORIGIN.replace(/\/$/, "")}/b/${encodeURIComponent(codigo)}`,
        };
      }

      const ownerUserId = (bike.clientes as { user_id?: string | null } | null)?.user_id ?? null;
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

    // Não logado, não dono, ou staff sem sessão no site → aviso público
    return { kind: "aviso", codigo };
  });
