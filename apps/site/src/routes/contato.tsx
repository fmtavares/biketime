import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Phone, MapPin, Mail, Instagram, Clock } from "lucide-react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — BikeTime" },
      { name: "description", content: "Fale com a BikeTime. Atendimento via WhatsApp, telefone e visitas agendadas." },
      { property: "og:title", content: "Contato — BikeTime" },
      { property: "og:description", content: "Atendimento premium para ciclistas." },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const channels = [
    { icon: MessageCircle, t: "WhatsApp", d: "Resposta em minutos", v: "Conversar agora", href: "https://wa.me/5511961680346", primary: true },
    { icon: Phone, t: "Telefone", d: "Seg–Sex · 9h–18h", v: "11 96168-0346", href: "tel:+5511961680346" },
    { icon: Mail, t: "Email", d: "Resposta em até 24h", v: "contato@biketime.com.br", href: "mailto:contato@biketime.com.br" },
    { icon: Instagram, t: "Instagram", d: "Bastidores e novidades", v: "@bike.time", href: "https://instagram.com" },
  ];

  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Contato</span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Vamos <span className="text-gradient-yellow">conversar.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Escolha o canal de sua preferência. Nossa equipe está pronta para atender.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {channels.map((c) => (
            <a
              key={c.t}
              href={c.href}
              target="_blank" rel="noreferrer"
              className={`hover-lift group flex items-center gap-5 rounded-2xl border p-6 ${
                c.primary
                  ? "border-primary/40 bg-primary/10"
                  : "border-border bg-surface/60"
              }`}
            >
              <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${
                c.primary ? "bg-primary text-primary-foreground" : "border border-primary/30 bg-primary/10 text-primary"
              }`}>
                <c.icon size={22} />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-semibold">{c.t}</h3>
                <p className="text-xs text-muted-foreground">{c.d}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{c.v}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface/60 p-6">
            <MapPin className="text-primary" size={22} />
            <h3 className="mt-3 font-display text-lg font-semibold">Endereço</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Rua Dr. Franco da Rocha, 404 — Perdizes<br /> São Paulo · SP
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface/60 p-6">
            <Clock className="text-primary" size={22} />
            <h3 className="mt-3 font-display text-lg font-semibold">Horário</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Segunda a Sexta: 9h às 19h<br /> Sábado: 9h às 14h
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
