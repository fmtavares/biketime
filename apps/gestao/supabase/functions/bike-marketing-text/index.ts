// Calls an OpenAI Assistant to generate marketing text for a bike,
// passing only the bike name as input.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ASSISTANT_ID = "asst_3b5wxXFKTotUgOGQNJioYBwi";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_HEADERS = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check — bloqueia chamadas anônimas
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Não autenticado." }, 401);

    const { bikeName } = await req.json();
    if (!bikeName || typeof bikeName !== "string") {
      return json({ error: "bikeName obrigatório" }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY não configurada" }, 500);

    // 1) Cria thread já com a mensagem do usuário
    const threadRes = await fetch("https://api.openai.com/v1/threads", {
      method: "POST",
      headers: OPENAI_HEADERS(apiKey),
      body: JSON.stringify({
        messages: [{ role: "user", content: bikeName }],
      }),
    });
    if (!threadRes.ok) return json({ error: `OpenAI thread: ${await threadRes.text()}` }, 500);
    const thread = await threadRes.json();

    // 2) Run
    const runRes = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
      method: "POST",
      headers: OPENAI_HEADERS(apiKey),
      body: JSON.stringify({ assistant_id: ASSISTANT_ID }),
    });
    if (!runRes.ok) return json({ error: `OpenAI run: ${await runRes.text()}` }, 500);
    let run = await runRes.json();

    // 3) Poll
    const started = Date.now();
    while (["queued", "in_progress", "cancelling"].includes(run.status)) {
      if (Date.now() - started > 90_000) return json({ error: "Timeout" }, 504);
      await new Promise((r) => setTimeout(r, 1200));
      const r = await fetch(
        `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
        { headers: OPENAI_HEADERS(apiKey) },
      );
      run = await r.json();
    }

    if (run.status !== "completed") {
      return json({ error: `Run status: ${run.status}`, detail: run.last_error }, 500);
    }

    // 4) Recupera última mensagem do assistant
    const msgsRes = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/messages?limit=10&order=desc`,
      { headers: OPENAI_HEADERS(apiKey) },
    );
    const msgs = await msgsRes.json();
    const assistantMsg = (msgs.data ?? []).find((m: any) => m.role === "assistant");
    const text = (assistantMsg?.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text?.value ?? "")
      .join("\n")
      .trim();

    return json({ text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
