// Edge Function: enfileira a geração de campanha em modo background na OpenAI
// e expõe um endpoint de polling. O cliente faz polling em `marketing_jobs`
// e a cada tick chama esta função com `{ poll: jobId }` para avançar o status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PROMPT_ID = "pmpt_6a00af1a86888194ab4547842a09cdc50b64440518b58d5a";
const PROMPT_VERSION = "1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function findImage(obj: unknown): string | null {
  if (!obj) return null;
  if (typeof obj === "string") {
    if (obj.startsWith("data:image/") || obj.startsWith("http")) return obj;
    if (obj.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(obj.slice(0, 200))) {
      return `data:image/png;base64,${obj.replace(/\s/g, "")}`;
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = findImage(it);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj === "object") {
    const o = obj as Record<string, unknown>;
    for (const k of ["result", "b64_json", "image_url", "url", "image", "data"]) {
      if (k in o) {
        const r = findImage(o[k]);
        if (r) return r;
      }
    }
    for (const v of Object.values(o)) {
      const r = findImage(v);
      if (r) return r;
    }
  }
  return null;
}

interface StartInputs {
  bikeName: string;
  slogan: string;
  price: string;
  description: string;
  bikePhoto: string;
  templatePhoto: string;
}

type Body =
  | ({ poll?: undefined } & StartInputs)
  | { poll: string };

async function startJob(
  admin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string,
  inputs: StartInputs,
) {
  const userText = [
    `Bike: ${inputs.bikeName}`,
    `Slogan: ${inputs.slogan}`,
    `Preço: ${inputs.price}`,
    `Descrição: ${inputs.description}`,
    "",
    "Use a primeira imagem como FOTO DA BIKE e a segunda imagem como TEMPLATE de publicação.",
  ].join("\n");

  const body = {
    background: true,
    prompt: { id: PROMPT_ID, version: PROMPT_VERSION },
    tools: [{ type: "image_generation", partial_images: 0 }],
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: userText },
          { type: "input_image", image_url: inputs.bikePhoto },
          { type: "input_image", image_url: inputs.templatePhoto },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as { id?: string };
  if (!data.id) throw new Error("OpenAI não retornou response id.");

  const { data: job, error: insErr } = await admin
    .from("marketing_jobs")
    .insert({
      user_id: userId,
      status: "processing",
      openai_response_id: data.id,
    })
    .select("id")
    .single();
  if (insErr || !job) throw new Error(insErr?.message ?? "Falha ao criar job.");

  return job.id as string;
}

async function pollJob(
  admin: ReturnType<typeof createClient>,
  userId: string,
  apiKey: string,
  jobId: string,
) {
  const { data: row, error } = await admin
    .from("marketing_jobs")
    .select("id, user_id, status, openai_response_id, image, error")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Job não encontrado.");
  if (row.user_id !== userId) throw new Error("Acesso negado.");

  if (row.status === "done" || row.status === "error") {
    return { status: row.status, image: row.image, error: row.error };
  }
  if (!row.openai_response_id) {
    return { status: row.status };
  }

  const res = await fetch(
    `https://api.openai.com/v1/responses/${row.openai_response_id}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  const status = data.status as string | undefined;

  if (status === "completed") {
    let image: string | null = null;
    const output = data.output as unknown;
    if (Array.isArray(output)) {
      for (const item of output) {
        const it = item as Record<string, unknown>;
        if (it?.type === "image_generation_call" && typeof it.result === "string") {
          image = `data:image/png;base64,${it.result}`;
        }
      }
    }
    if (!image) image = findImage(data);
    if (!image) {
      await admin.from("marketing_jobs").update({
        status: "error",
        error: "O assistente não retornou uma imagem.",
      }).eq("id", jobId);
      return { status: "error", error: "O assistente não retornou uma imagem." };
    }
    await admin.from("marketing_jobs").update({
      status: "done",
      image,
    }).eq("id", jobId);
    return { status: "done", image };
  }

  if (status === "failed" || status === "cancelled" || status === "canceled") {
    const err = (data.error as { message?: string } | undefined)?.message ??
      `OpenAI status: ${status}`;
    await admin.from("marketing_jobs").update({
      status: "error",
      error: err,
    }).eq("id", jobId);
    return { status: "error", error: err };
  }

  return { status: "processing" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase env ausente.");

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = (await req.json()) as Body;

    if ("poll" in body && body.poll) {
      const result = await pollJob(admin, userId, apiKey, body.poll);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inputs = body as StartInputs;
    if (!inputs.bikePhoto || !inputs.templatePhoto) {
      return new Response(
        JSON.stringify({ error: "bikePhoto e templatePhoto são obrigatórios (URLs)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jobId = await startJob(admin, userId, apiKey, inputs);
    return new Response(JSON.stringify({ jobId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("marketing-generate error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
