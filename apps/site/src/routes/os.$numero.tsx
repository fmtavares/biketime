import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert } from "lucide-react";

const WA = "https://wa.me/5511961680346";

export const Route = createFileRoute("/os/$numero")({
  head: ({ params }) => ({
    meta: [
      { title: `OS ${params.numero} · BikeTime` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OsQrPage,
});

/**
 * Landing pública do QR da etiqueta da OS.
 * Não expõe link da gestão; equipe usa o scanner dentro da gestão.
 */
function OsQrPage() {
  const { numero: numeroParam } = Route.useParams();
  const numero = numeroParam.trim().toUpperCase();

  return (
    <div className="container-px mx-auto max-w-lg py-16 md:py-24">
      <div className="flex size-12 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10">
        <ShieldAlert className="size-5 text-amber-400" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold">Bike Time</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Este QR identifica um comprovante de ordem de serviço da nossa oficina.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Para acompanhar sua OS, acesse o portal com seu e-mail e senha. Se ainda não
        tiver acesso, solicite na oficina.
      </p>
      {numero && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Ref.: {numero}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/minha-conta"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Minha conta
        </Link>
        <a
          href={WA}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold"
        >
          <MessageCircle size={16} />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
