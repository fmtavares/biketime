import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const acessoSchema = z.object({
  clienteId: z.string().uuid(),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  nome: z.string().optional(),
});

/**
 * Cria ou redefine o acesso do cliente no Supabase Auth (senha não fica em `clientes`).
 * Só equipe (is_staff) pode chamar.
 * Se o e-mail já for da equipe, vincula o mesmo Auth ao cadastro (senha passa a valer nos dois).
 */
export const definirAcessoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => acessoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: staff, error: staffErr } = await supabaseAdmin.rpc("is_staff", {
      _user_id: userId,
    });
    if (staffErr || staff !== true) {
      return {
        ok: false as const,
        error: "Somente a equipe pode gerenciar acesso de clientes",
      };
    }

    const email = data.email.trim().toLowerCase();
    const { data: cliente, error: cliErr } = await supabaseAdmin
      .from("clientes")
      .select("id, email, user_id, nome")
      .eq("id", data.clienteId)
      .maybeSingle();

    if (cliErr || !cliente) {
      return { ok: false as const, error: "Cliente não encontrado" };
    }

    let authUserId = cliente.user_id as string | null;
    let emailEquipe = false;
    let criado = false;

    if (authUserId) {
      const { data: aindaStaff } = await supabaseAdmin.rpc("is_staff", {
        _user_id: authUserId,
      });
      emailEquipe = aindaStaff === true;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.nome || cliente.nome,
          ...(emailEquipe ? {} : { tipo: "cliente" }),
        },
      });
      if (updErr) {
        return { ok: false as const, error: updErr.message || "Erro ao atualizar senha" };
      }
    } else {
      const { data: perfilExistente } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (perfilExistente?.id) {
        authUserId = perfilExistente.id;
        const { data: jaStaff } = await supabaseAdmin.rpc("is_staff", {
          _user_id: authUserId,
        });
        emailEquipe = jaStaff === true;

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: data.password,
          email_confirm: true,
          user_metadata: {
            full_name: data.nome || cliente.nome,
            ...(emailEquipe ? {} : { tipo: "cliente" }),
          },
        });
        if (updErr) {
          return {
            ok: false as const,
            error: updErr.message || "Erro ao vincular usuário existente",
          };
        }

        if (!emailEquipe) {
          await supabaseAdmin
            .from("user_roles")
            .upsert({ user_id: authUserId, role: "cliente" }, { onConflict: "user_id,role" });
        }
      } else {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            full_name: data.nome || cliente.nome,
            tipo: "cliente",
          },
        });
        if (createErr || !created.user) {
          return {
            ok: false as const,
            error: createErr?.message || "Erro ao criar acesso",
          };
        }
        authUserId = created.user.id;
        criado = true;
      }

      const { error: linkErr } = await supabaseAdmin
        .from("clientes")
        .update({ user_id: authUserId, email })
        .eq("id", data.clienteId);

      if (linkErr) {
        return {
          ok: false as const,
          error: linkErr.message || "Erro ao vincular acesso ao cliente",
        };
      }
    }

    if ((cliente.email ?? "").toLowerCase() !== email) {
      await supabaseAdmin.from("clientes").update({ email }).eq("id", data.clienteId);
    }

    return {
      ok: true as const,
      userId: authUserId,
      criado,
      emailEquipe,
    };
  });
