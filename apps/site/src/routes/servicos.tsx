import { createFileRoute } from "@tanstack/react-router";
import {
  Wrench, Activity, Shield, Sparkles, Cog, Droplets, Settings2, Briefcase, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/servicos")({
  head: () => ({
    meta: [
      { title: "Oficina de Bike em São Paulo · Zona Oeste | BikeTime" },
      { name: "description", content: "Oficina de bicicleta na zona oeste de São Paulo: revisão, bike fit, manutenção, montagem e upgrades. Atendimento técnico premium para ciclistas." },
      { property: "og:title", content: "Oficina de Bike em São Paulo · Zona Oeste | BikeTime" },
      { property: "og:description", content: "Revisão, bike fit e manutenção de bicicletas na zona oeste de SP. Técnicos especializados, ferramental profissional e garantia em todos os serviços." },
      { property: "og:url", content: "https://biketime.com.br/servicos" },
    ],
    links: [
      { rel: "canonical", href: "https://biketime.com.br/servicos" },
    ],
  }),
  component: ServicosPage,
});

const services = [
  { icon: Droplets, title: "Revisão Simples", desc: "Serviço econômica para manter seu equipamento em condições.", items: ["Lavagem da bike", "Sem desmontar bike", "Regulagem dos câmbios", "Teste da Bike"] },
  { icon: Shield, title: "Revisão Intermediária", desc: "Revisão com alto valor agregado, indicada para ciclistas que utilizam com muita frequência seus equipamentos.", items: ["Tudo da Revisão Simples", "Desmontagem dos Câmbios", "Alinhamento Geral", "Garantia de 1 mês"] },
  { icon: Wrench, title: "Revisão Premium", desc: "Checklist técnico de mais de 40 pontos com diagnóstico transparente.", items: ["Desmontagem completa", "Indicada para atletas de competição", "Ajuste completo", "Aplicação de produtos especializados"] },
  { icon: Activity, title: "Bike Fit", desc: "Posicionamento científico para conforto, potência e prevenção de lesões.", items: ["Avaliação postural", "Medições dinâmicas", "Ajuste de cleats", "Relatório completo"] },
  { icon: Cog, title: "Upgrade de Componentes", desc: "Curadoria e instalação dos melhores grupos, rodas e cockpits.", items: ["Consultoria técnica", "Marcas premium", "Sangria e tunning", "Configuração eletrônica"] },
  { icon: Settings2, title: "Montagem Profissional", desc: "Montagem de bikes novas com torque calibrado e precisão.", items: ["Torque por componente", "Alinhamento perfeito", "Configuração inicial", "Test ride"] },
  { icon: Sparkles, title: "Ajustes Finos", desc: "Tunagem de câmbio, freios e cockpit para a melhor experiência.", items: ["Atualização e ajuste de câmbios eletrônicos", "Sangria de Freio Hidráulico", "Torqueamento de componentes críticos", "Pressão de pneus"] },
  { icon: Briefcase, title: "Mala Bike", desc: "Vai viajar? Conte com a BikeTime para montagem, desmontagem e empréstimo de mala bike para proteger adequadamente seu equipamento no transporte.", items: ["Empréstimo para clientes", "Aluguel Mala Bike"] },
];

function ServicosPage() {
  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Serviços</span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Tecnologia e <span className="text-gradient-yellow">precisão</span> em cada serviço.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Da manutenção preventiva à customização avançada. Cada serviço é executado com padrão
          técnico rigoroso e ferramental profissional.
        </p>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-24">
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((s) => (
            <article key={s.title} className="hover-lift group relative overflow-hidden rounded-2xl border border-border bg-surface/60 p-8">
              <div className="flex items-start gap-5">
                <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <s.icon size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                  <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    {s.items.map((i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-1 w-1 rounded-full bg-primary" /> {i}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="https://wa.me/5511961680346"
                    target="_blank" rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    Solicitar orçamento <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
