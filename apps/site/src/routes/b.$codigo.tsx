import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bike, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  resolveBikeQr,
  type BikeQrResolve,
} from "@/lib/bike-qr.functions";

const WA = "https://wa.me/5511961680346";

export const Route = createFileRoute("/b/$codigo")({
  head: ({ params }) => ({
    meta: [
      { title: `Bike ${params.codigo} · BikeTime` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BikeQrPage,
});

/**
 * Landing do QR do adesivo da bike (URL pública do site).
 * Cliente dono vê a bike; staff vai para a gestão; demais veem aviso.
 */
function BikeQrPage() {
  const { codigo: codigoParam } = Route.useParams();
  const resolver = useServerFn(resolveBikeQr);
  const [result, setResult] = useState<BikeQrResolve | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? null;
      try {
        const res = await resolver({
          data: { codigo: codigoParam, accessToken },
        });
        if (!cancelled) setResult(res);
      } catch {
        if (!cancelled) {
          setResult({
            kind: "aviso",
            codigo: codigoParam.trim().toUpperCase(),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [codigoParam, resolver]);

  useEffect(() => {
    if (result?.kind === "staff" && result.gestaoUrl) {
      window.location.href = result.gestaoUrl;
    }
  }, [result]);

  if (loading || result?.kind === "staff") {
    return (
      <div className="container-px mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="mt-3 text-sm">
          {result?.kind === "staff" ? "Abrindo na gestão…" : "Identificando bike…"}
        </p>
      </div>
    );
  }

  if (result?.kind === "owner") {
    const b = result.bike;
    const nome = `${b.marca} ${b.modelo}`.trim();
    return (
      <div className="container-px mx-auto max-w-lg py-16 md:py-24">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          / Sua bike
        </span>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Bike className="size-5 text-primary" />
          </div>
          <div>
            <p className="font-mono text-xs text-muted-foreground">{result.codigo}</p>
            <h1 className="font-display text-3xl font-bold">{nome}</h1>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {[
            b.ano && String(b.ano),
            b.tamanho && `Tam. ${b.tamanho}`,
            b.cor,
            b.numero_serie && `SN ${b.numero_serie}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Esta bike está vinculada à sua conta Bike Time.
        </p>
        <Link
          to="/minha-conta"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Ir para Minha conta
        </Link>
      </div>
    );
  }

  return <AvisoAdministracao codigo={result?.codigo ?? codigoParam} />;
}

/**
 * Aviso público quando não há login de dono/staff ou o código não resolve.
 */
function AvisoAdministracao({ codigo }: { codigo: string }) {
  return (
    <div className="container-px mx-auto max-w-lg py-16 md:py-24">
      <div className="flex size-12 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
        <ShieldAlert className="size-5 text-amber-400" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold">Bike Time</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Este QR identifica uma bicicleta da nossa oficina.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Se você encontrou esta bike ou precisa de ajuda, procure a administração da Bike
        Time — nós cuidamos para que ela seja destinada ao cliente correto.
      </p>
      {codigo && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Ref.: {codigo}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={WA}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <MessageCircle size={16} />
          WhatsApp Bike Time
        </a>
        <Link
          to="/contato"
          className="inline-flex items-center rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          Contato
        </Link>
      </div>
    </div>
  );
}
