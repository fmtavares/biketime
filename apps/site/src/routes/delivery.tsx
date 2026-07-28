import { createFileRoute } from "@tanstack/react-router";
import { Truck, Clock, Shield, MapPin, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery — BikeTime" },
      { name: "description", content: "Serviço de coleta e entrega da sua bicicleta com segurança e agilidade." },
      { property: "og:title", content: "Delivery — BikeTime" },
      { property: "og:description", content: "Coleta e entrega premium da sua bike." },
    ],
  }),
  component: DeliveryPage,
});

function DeliveryPage() {
  const steps = [
    { n: "01", t: "Solicite", d: "Entre em contato pelo WhatsApp e agende a coleta no horário ideal." },
    { n: "02", t: "Coletamos", d: "Nossa equipe vai até você com transporte seguro e acolchoado." },
    { n: "03", t: "Executamos", d: "Realizamos o serviço com acompanhamento em tempo real." },
    { n: "04", t: "Entregamos", d: "Devolvemos sua bike pronta para a próxima pedalada." },
  ];

  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Delivery</span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Sua bike vai e <span className="text-gradient-yellow">volta pronta.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Coleta e entrega premium. Você não precisa sair de casa para garantir o melhor cuidado
          para sua bicicleta.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { icon: Truck, t: "Transporte seguro" },
            { icon: Shield, t: "Transporte próprio" },
            { icon: Clock, t: "Agendamento flexível" },
            { icon: MapPin, t: "Atendimento na região" },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-border bg-surface/60 p-6">
              <b.icon className="text-primary" size={22} />
              <p className="mt-3 text-sm font-semibold">{b.t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-24">
        <h2 className="font-display text-3xl font-bold md:text-4xl">Como funciona</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl border border-border bg-surface/60 p-6">
              <div className="font-display text-5xl font-bold text-primary/30">{s.n}</div>
              <h3 className="mt-3 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <a
            href="https://wa.me/5511961680346"
            target="_blank" rel="noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-[var(--shadow-glow)]"
          >
            Solicitar coleta <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </section>
    </div>
  );
}
