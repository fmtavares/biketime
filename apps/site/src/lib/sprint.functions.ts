import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
      const run = await openai(`/threads/${threadId}/runs`, apiKey, {
        method: "POST",
        body: JSON.stringify({ assistant_id: assistantId }),
      });

      // 4. Poll until completion (max ~45s)
      const start = Date.now();
      let status = run.status as string;
      let runId = run.id as string;
      while (
        ["queued", "in_progress", "cancelling"].includes(status) &&
        Date.now() - start < 45000
      ) {
        await new Promise((r) => setTimeout(r, 800));
        const polled = await openai(
          `/threads/${threadId}/runs/${runId}`,
          apiKey,
          { method: "GET" }
        );
        status = polled.status;
      }

      if (status !== "completed") {
        return {
          threadId,
          error: `SPRINT não conseguiu responder agora (${status}). Tenta de novo?`,
        };
      }

      // 5. Read latest assistant message
      const msgs = await openai(
        `/threads/${threadId}/messages?limit=1&order=desc`,
        apiKey,
        { method: "GET" }
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
