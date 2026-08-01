import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { toast } from "sonner";

type CompartilharShowroomProps = {
  /** Título curto (ex.: marca + modelo). */
  title: string;
  /** Texto completo com URL (fallback do clipboard / Web Share). */
  text: string;
  /** URL canônica do item. */
  url: string;
};

/**
 * Botão de compartilhar item do showroom.
 * Usa Web Share API no mobile; no desktop copia o link.
 */
export function CompartilharShowroom({ title, text, url }: CompartilharShowroomProps) {
  const [copiado, setCopiado] = useState(false);

  /** Abre o sheet nativo ou copia o link para a área de transferência. */
  async function compartilhar() {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopiado(true);
      toast.success("Link copiado — cole no WhatsApp ou Instagram");
      window.setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      // Usuário cancelou o share nativo — não tratar como erro
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        toast.success("Link copiado");
        window.setTimeout(() => setCopiado(false), 2000);
      } catch {
        toast.error("Não foi possível compartilhar");
      }
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      aria-label="Compartilhar este item"
    >
      {copiado ? <Check size={18} className="text-primary" /> : <Share2 size={18} />}
      {copiado ? "Link copiado" : "Compartilhar"}
    </button>
  );
}
