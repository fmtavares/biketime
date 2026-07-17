// Edge function for admin user management (create, update, delete)
// Requires the caller to be authenticated AND have the 'admin' role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Check admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Acesso negado" }, 403);

    const body = await req.json();
    const action = body.action as string;

    if (action === "create") {
      const { email, password, full_name, role } = body;
      if (!email || !password) return json({ error: "Email e senha obrigatórios" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (error) return json({ error: error.message }, 400);

      // Trigger creates profile + default 'vendedor' role. Add extra role if requested.
      if (data.user && (role === "admin" || role === "tecnico")) {
        await admin.from("user_roles").insert({ user_id: data.user.id, role });
      }
      return json({ ok: true, user: data.user });
    }

    if (action === "update") {
      const { user_id, full_name, password } = body;
      if (!user_id) return json({ error: "user_id obrigatório" }, 400);
      if (full_name !== undefined) {
        await admin.from("profiles").update({ full_name }).eq("id", user_id);
      }
      if (password) {
        const { error } = await admin.auth.admin.updateUserById(user_id, { password });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id obrigatório" }, 400);
      if (user_id === userData.user.id) return json({ error: "Não é possível excluir a si mesmo" }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
