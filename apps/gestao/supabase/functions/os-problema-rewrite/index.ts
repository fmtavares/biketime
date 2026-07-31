// Edge Function: reescreve o "problema relatado" da OS para linguagem clara ao cliente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Você é redator da oficina Bike Time.
Reescreva o relato do problema da ordem de serviço em português do Brasil, para o cliente ler no portal.

Regras:
- Tom claro, profissional e acolhedor
- Sem jargão interno da oficina; se houver termo técnico, explique em linguagem simples
- Preserve o sentido do relato original; não invente sintomas, peças ou diagnósticos
- 2 a 4 frases curtas
- Não use título, aspas, markdown nem prefixos ("Problema:", "Cliente:")
- Responda somente com o texto final`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json();
    const texto = typeof body?.texto === "string" ? body.texto.trim() : "";
    const checklist =
      typeof body?.checklist === "string" ? body.checklist.trim() : "";
    const bike = typeof body?.bike === "string" ? body.bike.trim() : "";
    const servicos =
      typeof body?.servicos === "string" ? body.servicos.trim() : "";
    const contexto =
      body?.contexto === "observacao_servico_direto"
        ? "observacao_servico_direto"
        : "problema_relatado";

    if (!texto && !checklist && !servicos) {
      return json(
        {
          error:
            "Informe o texto, o checklist ou os serviços para a IA reescrever.",
        },
        400,
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "OPENAI_API_KEY não configurada." }, 500);

    const campoLabel =
      contexto === "observacao_servico_direto"
        ? "Observação (serviço direto)"
        : "Problema relatado";

    const userParts = [
      bike ? `Bike: ${bike}` : null,
      servicos ? `Serviços contratados: ${servicos}` : null,
      texto ? `Rascunho atual:\n${texto}` : null,
      checklist
        ? `Checklist visual de entrada (contexto interno, não copiar literal):\n${checklist}`
        : null,
      `Gere o texto final do campo ${campoLabel}, visível ao cliente no portal.`,
    ].filter(Boolean);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userParts.join("\n\n") },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `OpenAI ${res.status}: ${detail.slice(0, 400)}` }, 500);
    }

    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!text) return json({ error: "A IA não retornou texto." }, 500);

    return json({ text });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : String(e) },
      500,
    );
  }
});

/**
 * Resposta JSON com headers CORS.
 */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
