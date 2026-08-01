import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({
  message: z.string().min(1).max(4000),
  threadId: z.string().optional().nullable(),
});

const OPENAI_BASE = "https://api.openai.com/v1";
const HEADERS_BASE = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2",
});

const TOOL_CONSULTAR_PRECOS = "consultar_precos";
const POLL_MAX_MS = 45000;
const POLL_INTERVAL_MS = 800;

type ToolCall = {
  id: string;
  type: string;
  function?: { name?: string; arguments?: string };
};

type RunPayload = {
  id: string;
  status: string;
  required_action?: {
    type: string;
    submit_tool_outputs?: {
      tool_calls?: ToolCall[];
    };
  };
};

type ServicoPreco = {
  codigo: string;
  nome: string;
  descricao: string | null;
  valor: number;
};

async function openai(path: string, key: string, init?: RequestInit) {
  const res = await fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: { ...HEADERS_BASE(key), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Formata valor em BRL para a resposta da tool.
 */
function fmtBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Consulta a tabela oficial `servicos_precos` no Supabase.
 * Busca por nome, código ou descrição (case-insensitive).
 */
async function consultarPrecos(busca: string): Promise<{
  encontrados: Array<{
    codigo: string;
    nome: string;
    descricao: string | null;
    valor: string;
  }>;
  total: number;
  aviso?: string;
}> {
  const q = busca.trim();
  if (!q) {
    return {
      encontrados: [],
      total: 0,
      aviso: "Informe um termo de busca (ex.: revisão, bike fit).",
    };
  }

  // Tabela existe no projeto; ainda não tipada no client do site
  const { data, error } = await (supabaseAdmin as any)
    .from("servicos_precos")
    .select("codigo, nome, descricao, valor")
    .order("codigo");

  if (error) {
    console.error("SPRINT consultar_precos:", error.message);
    return {
      encontrados: [],
      total: 0,
      aviso: "Não foi possível consultar a tabela de preços agora.",
    };
  }

  const rows = (data ?? []) as ServicoPreco[];
  const needle = q
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const lista = rows.filter((s) => {
    const blob = [s.codigo, s.nome, s.descricao ?? ""]
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    return blob.includes(needle);
  });

  // Se nada bater, devolve amostra pequena para o modelo orientar o cliente
  const escolhidos = lista.length > 0 ? lista.slice(0, 15) : rows.slice(0, 8);

  return {
    encontrados: escolhidos.map((s) => ({
      codigo: s.codigo,
      nome: s.nome,
      descricao: s.descricao,
      valor: fmtBrl(Number(s.valor) || 0),
    })),
    total: lista.length,
    aviso:
      lista.length === 0
        ? "Nenhum serviço com esse termo. Segue uma amostra do catálogo; se não couber, oriente WhatsApp."
        : undefined,
  };
}

/**
 * Executa a tool pedida pelo Assistant e devolve o output em JSON.
 */
async function executarTool(call: ToolCall): Promise<string> {
  const name = call.function?.name ?? "";
  let args: { busca?: string } = {};
  try {
    args = JSON.parse(call.function?.arguments || "{}") as { busca?: string };
  } catch {
    args = {};
  }

  if (name === TOOL_CONSULTAR_PRECOS) {
    const result = await consultarPrecos(args.busca ?? "");
    return JSON.stringify(result);
  }

  return JSON.stringify({
    erro: `Tool desconhecida: ${name}`,
  });
}

/**
 * Quando o run pede tool calls, consulta o Supabase e envia os outputs à OpenAI.
 */
async function resolverToolCalls(
  threadId: string,
  runId: string,
  apiKey: string,
  run: RunPayload,
) {
  const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls ?? [];
  if (!toolCalls.length) {
    throw new Error("requires_action sem tool_calls");
  }

  const tool_outputs = await Promise.all(
    toolCalls.map(async (call) => ({
      tool_call_id: call.id,
      output: await executarTool(call),
    })),
  );

  return openai(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, apiKey, {
    method: "POST",
    body: JSON.stringify({ tool_outputs }),
  }) as Promise<RunPayload>;
}

/**
 * Poll do run: trata requires_action (tools) até completed ou timeout.
 */
async function aguardarRun(
  threadId: string,
  runId: string,
  apiKey: string,
  initial: RunPayload,
): Promise<RunPayload> {
  const start = Date.now();
  let run = initial;
  let status = run.status;

  while (Date.now() - start < POLL_MAX_MS) {
    if (status === "requires_action") {
      run = await resolverToolCalls(threadId, runId, apiKey, run);
      status = run.status;
      continue;
    }

    if (!["queued", "in_progress", "cancelling"].includes(status)) {
      return run;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    run = (await openai(`/threads/${threadId}/runs/${runId}`, apiKey, {
      method: "GET",
    })) as RunPayload;
    status = run.status;
  }

  return run;
}

/**
 * Server function do chat SPRINT (Assistants API + tool consultar_precos).
 */
export const chatWithSprint = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!apiKey || !assistantId) {
      return {
        error: "SPRINT está offline no momento. Tente novamente mais tarde.",
      };
    }

    try {
      let threadId = data.threadId ?? null;

      // 1. Ensure thread
      if (!threadId) {
        const thread = await openai("/threads", apiKey, {
          method: "POST",
          body: JSON.stringify({}),
        });
        threadId = thread.id as string;
      }

      // 2. Add user message
      await openai(`/threads/${threadId}/messages`, apiKey, {
        method: "POST",
        body: JSON.stringify({ role: "user", content: data.message }),
      });

      // 3. Create run
      const run = (await openai(`/threads/${threadId}/runs`, apiKey, {
        method: "POST",
        body: JSON.stringify({ assistant_id: assistantId }),
      })) as RunPayload;

      // 4. Poll (+ tools) até completion
      const finished = await aguardarRun(threadId, run.id, apiKey, run);

      if (finished.status !== "completed") {
        return {
          threadId,
          error: `SPRINT não conseguiu responder agora (${finished.status}). Tenta de novo?`,
        };
      }

      // 5. Read latest assistant message
      const msgs = await openai(
        `/threads/${threadId}/messages?limit=1&order=desc`,
        apiKey,
        { method: "GET" },
      );
      const last = msgs.data?.[0];
      const reply =
        last?.content
          ?.filter((c: { type: string }) => c.type === "text")
          .map((c: { text: { value: string } }) => c.text.value)
          .join("\n\n") ?? "...";

      return { threadId, reply };
    } catch (e) {
      console.error("SPRINT error:", e);
      return {
        error: "Tive um probleminha técnico. Pode tentar de novo?",
      };
    }
  });
