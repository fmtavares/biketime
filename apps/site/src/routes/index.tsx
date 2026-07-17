import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Wrench, Activity, Shield, Sparkles, Cog, Droplets, Settings2,
  ArrowRight, CheckCircle2, Zap, Award, Clock, Users,
} from "lucide-react";
import heroBike from "@/assets/hero-bike.jpg";
import workshop from "@/assets/workshop.jpg";
import { TestimonialsCarousel } from "@/components/testimonials-carousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BikeTime · Oficina de Bicicleta em São Paulo (Zona Oeste)" },
      { name: "description", content: "Oficina de bike premium na zona oeste de São Paulo. Bike fit, revisão completa, manutenção, montagem e upgrades de alta performance. Agende pelo WhatsApp." },
      { property: "og:title", content: "BikeTime · Oficina de Bicicleta em São Paulo (Zona Oeste)" },
      { property: "og:description", content: "Bike fit, revisão e manutenção de bicicletas na zona oeste de SP. Atendimento técnico especializado para ciclistas exigentes." },
      { property: "og:url", content: "https://biketime.com.br/" },
    ],
    links: [
      { rel: "canonical", href: "https://biketime.com.br/" },
    ],
  }),
  component: HomePage,
});

const services = [
  { icon: Wrench, title: "Revisão Completa", desc: "Diagnóstico técnico ponta a ponta com checklist de mais de 40 pontos." },
  { icon: Activity, title: "Bike Fit", desc: "Posicionamento profissional para mais conforto, potência e prevenção de lesões." },
  
  { icon: Cog, title: "Upgrade de Componentes", desc: "Curadoria e instalação dos melhores grupos, rodas e cockpits do mercado." },
  { icon: Settings2, title: "Montagem Profissional", desc: "Montagem de bikes novas com torque calibrado e regulagem de precisão." },
  { icon: Droplets, title: "Lavagem Técnica", desc: "Lavagem detalhada com produtos específicos para componentes e transmissão." },
  { icon: Sparkles, title: "Ajustes Finos", desc: "Tunagem de câmbio, freios e cockpit para a melhor experiência de pedalada." },
];

const differentials = [
  { icon: Award, title: "Técnicos Especializados", desc: "Equipe com formação contínua nas principais marcas e tecnologias." },
  { icon: Zap, title: "Ferramental Profissional", desc: "Bancadas e ferramentas de alta precisão para cada componente." },
  { icon: Users, title: "Atendimento Premium", desc: "Diagnóstico transparente, orçamento detalhado e relacionamento próximo." },
  { icon: Clock, title: "Agilidade", desc: "Prazos cumpridos com acompanhamento em tempo real do seu serviço." },
];

function HomePage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroBike}
            alt="Bicicleta de alta performance"
            className="h-full w-full object-cover opacity-60"
            width={1920}
            height={1080}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/20 to-transparent" />
        </div>

        <div className="container-px mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-center py-24">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Oficina premium · Tecnologia esportiva
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] text-foreground md:text-7xl lg:text-8xl">
              Alta performance <br />
              para sua <span className="text-gradient-yellow">bicicleta.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">
              Oficina especializada, tecnologia e atendimento profissional para quem leva o
              ciclismo a sério.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="https://wa.me/5511961680346"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-[1.03] hover:shadow-[var(--shadow-glow)]"
              >
                Falar no WhatsApp
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </a>
              <button
                type="button"
                onClick={() => (window as unknown as { openSprint?: () => void }).openSprint?.()}
                className="group inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:shadow-[var(--shadow-neon)]"
                style={{ background: "var(--gradient-neon)" }}
              >
                Conversar com SPRINT 🤖
              </button>
              <Link
                to="/servicos"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/40 px-7 py-3.5 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-surface"
              >
                Conhecer serviços
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="container-px mx-auto max-w-7xl pb-12">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border/60 md:grid-cols-4">
            {[
              ["+5.000", "Bikes atendidas"],
              ["+40", "Pontos de revisão"],
              ["10 anos", "De experiência"],
              ["100%", "Satisfação"],
            ].map(([n, l]) => (
              <div key={l} className="bg-background/95 p-6 text-center backdrop-blur">
                <div className="font-display text-3xl font-bold text-primary md:text-4xl">{n}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section className="container-px mx-auto max-w-7xl py-24 md:py-32">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              / Serviços
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
              Precisão em cada componente.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Soluções completas para sua bicicleta — da manutenção preventiva à customização
              avançada.
            </p>
          </div>
          <Link
            to="/servicos"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Ver todos
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article
              key={s.title}
              className="hover-lift group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-7 backdrop-blur"
            >
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <s.icon size={22} />
              </div>
              <h3 className="font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              <a
                href="https://wa.me/5511961680346"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
              >
                Solicitar <ArrowRight size={14} />
              </a>
              <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
            </article>
          ))}
        </div>
      </section>

      {/* DIFERENCIAIS - split */}
      <section className="border-y border-border bg-surface/40">
        <div className="container-px mx-auto grid max-w-7xl gap-12 py-24 lg:grid-cols-2 lg:py-32">
          <div className="relative">
            <img
              src={workshop}
              alt="Oficina BikeTime"
              loading="lazy"
              width={1280}
              height={896}
              className="aspect-[4/5] w-full rounded-2xl object-cover"
            />
            <div className="absolute -bottom-6 -right-6 hidden rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-card)] md:block">
              <div className="font-display text-3xl font-bold text-primary">10+</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Anos de oficina</div>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">
              / Diferenciais
            </span>
            <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
              Performance é detalhe. <br /> Detalhe é tudo.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cada bike que entra na BikeTime passa por um padrão técnico rigoroso. Nada sai
              daqui sem precisão milimétrica.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {differentials.map((d) => (
                <div key={d.title} className="rounded-xl border border-border bg-background/60 p-5">
                  <d.icon size={20} className="text-primary" />
                  <h3 className="mt-3 font-semibold">{d.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* DEPOIMENTOS */}
      <TestimonialsCarousel />

      {/* CTA Final */}
      <section className="container-px mx-auto max-w-7xl pb-24 md:pb-32">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-surface via-surface-elevated to-surface p-10 md:p-16">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
                Sua bike merece o melhor. <br />
                <span className="text-gradient-yellow">Vamos conversar.</span>
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Agende um diagnóstico ou solicite seu orçamento. Atendimento direto pelo WhatsApp.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {["Diagnóstico transparente", "Orçamento sem surpresas", "Garantia em todos os serviços"].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={18} className="text-primary" /> {t}
                </div>
              ))}
              <a
                href="https://wa.me/5511961680346"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-[var(--shadow-glow)]"
              >
                Falar no WhatsApp <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
