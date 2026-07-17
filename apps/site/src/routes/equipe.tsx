import { createFileRoute } from "@tanstack/react-router";
import fabioPhoto from "@/assets/team-fabio.jpg";
import lucianoPhoto from "@/assets/team-luciano.jpg";

export const Route = createFileRoute("/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — BikeTime" },
      { name: "description", content: "Conheça os técnicos especializados da BikeTime." },
      { property: "og:title", content: "Equipe — BikeTime" },
      { property: "og:description", content: "Técnicos especializados em alta performance." },
    ],
  }),
  component: EquipePage,
});

type Member = { name: string; initials: string; role: string; bio: string; photo?: string };

const team: Member[] = [
  { name: "Fabio Tavares", initials: "FT", role: "Proprietário", bio: "Fundador da BikeTime. Apaixonado pelo ciclismo e pela cultura de alta performance.", photo: fabioPhoto },
  { name: "Luciano (Pinguim)", initials: "LP", role: "Líder de Oficina", bio: "Comanda a oficina com técnica apurada e olho clínico para detalhes.", photo: lucianoPhoto },
  { name: "Andre", initials: "A", role: "Líder de Vendas", bio: "Curadoria de produtos e atendimento consultivo para cada perfil de ciclista." },
  { name: "Wellington", initials: "W", role: "Assistente Mecânico", bio: "Suporte técnico na oficina com foco em precisão e agilidade." },
];

function EquipePage() {
  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Equipe</span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Pessoas que vivem <span className="text-gradient-yellow">o esporte.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Nossa equipe combina técnica de alto nível com a paixão genuína pelo ciclismo.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((m) => (
            <article key={m.name} className="hover-lift overflow-hidden rounded-2xl border border-border bg-surface/60">
              <div className="relative aspect-[3/4] bg-gradient-to-br from-surface-elevated to-background">
                {m.photo ? (
                  <img src={m.photo} alt={m.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-display text-7xl font-bold text-primary/20">
                      {m.initials}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              </div>
              <div className="p-5">
                <h3 className="font-display text-lg font-semibold">{m.name}</h3>
                <p className="text-xs uppercase tracking-widest text-primary">{m.role}</p>
                <p className="mt-3 text-sm text-muted-foreground">{m.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
