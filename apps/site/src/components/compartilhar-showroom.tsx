import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

type CompartilharShowroomProps = {
  /** Título curto (ex.: marca + modelo). */
  title: string;
  /** Texto completo com URL (fallback do clipboard / Web Share). */
  text: string;
  /** URL canônica do item. */
  url: string;
};

/** Detecta smartphone/tablet onde o sheet nativo de share faz sentido. */
function isMobileClient() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Botão de compartilhar item do showroom.
 * Mobile: Web Share API. Desktop/Mac: só copia o link (sem abrir apps).
 */
export function CompartilharShowroom({ title, text, url }: CompartilharShowroomProps) {
  const [copiado, setCopiado] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileClient());
  }, []);

  /** Copia o texto/link para a área de transferência. */
  async function copiarLink() {
    await navigator.clipboard.writeText(text);
    setCopiado(true);
    toast.success("Link copiado — cole onde quiser");
    window.setTimeout(() => setCopiado(false), 2000);
  }

  /** No mobile abre o share nativo; no desktop apenas copia. */
  async function compartilhar() {
    try {
      if (mobile && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      await copiarLink();
    } catch (err) {
      // Usuário cancelou o share nativo — não tratar como erro
      if (err instanceof DOMException && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        toast.success("Link copiado");
        window.setTimeout(() => setCopiado(false), 2000);
      } catch {
        toast.error("Não foi possível copiar o link");
      }
    }
  }

  const label = copiado ? "Link copiado" : mobile ? "Compartilhar" : "Copiar link";
  const Icon = copiado ? Check : mobile ? Share2 : Link2;

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      aria-label={mobile ? "Compartilhar este item" : "Copiar link deste item"}
    >
      <Icon size={18} className={copiado ? "text-primary" : undefined} />
      {label}
    </button>
  );
}
