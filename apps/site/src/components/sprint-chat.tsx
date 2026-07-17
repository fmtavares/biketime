import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import sprintMascot from "@/assets/sprint-mascot.png";
import { chatWithSprint } from "@/lib/sprint.functions";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Oi! Sou o **SPRINT** 🤖 — o assistente da Bike Time. Posso te ajudar com dúvidas sobre a loja, nossos serviços, ou só bater um papo sobre ciclismo. O que rola hoje?",
};

export function SprintChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chat = useServerFn(chatWithSprint);

  // Expose global opener for CTA buttons
  useEffect(() => {
    (window as unknown as { openSprint?: () => void }).openSprint = () =>
      setOpen(true);
  }, []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await chat({ data: { message: text, threadId } });
      if (res.threadId) setThreadId(res.threadId);
      const reply =
        "error" in res && res.error
          ? `⚠️ ${res.error}`
          : (res as { reply?: string }).reply ?? "...";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "⚠️ Falha de conexão. Tente novamente." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Conversar com SPRINT"
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-[var(--shadow-neon)] transition-transform hover:scale-110 sprint-pulse"
          style={{ background: "var(--gradient-neon)" }}
        >
          <img
            src={sprintMascot}
            alt=""
            className="h-14 w-14 object-contain drop-shadow-lg"
          />
          <span className="absolute inset-0 rounded-full ring-2 ring-[oklch(0.85_0.18_220/0.6)]" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat com SPRINT"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[100dvh] w-full flex-col border border-border bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:h-[600px] sm:w-[400px] sm:rounded-2xl"
        >
          {/* Header */}
          <header
            className="flex items-center gap-3 rounded-t-2xl px-4 py-3 text-white"
            style={{ background: "var(--gradient-neon)" }}
          >
            <img
              src={sprintMascot}
              alt="SPRINT"
              className="h-10 w-10 rounded-full bg-black/20 object-contain p-0.5"
            />
            <div className="flex-1">
              <div className="font-display text-base font-bold leading-tight">
                SPRINT
              </div>
              <div className="flex items-center gap-1.5 text-xs opacity-90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Online · IA da Bike Time
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-full p-1.5 hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-surface/40 px-4 py-4"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl border border-border bg-background px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 border-t border-border bg-background px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunta algo ao SPRINT..."
              disabled={loading}
              className="flex-1 rounded-full border border-border bg-surface/60 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--gradient-neon)" }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
