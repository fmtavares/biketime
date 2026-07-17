import { createFileRoute } from "@tanstack/react-router";
import { Target, Heart, Trophy } from "lucide-react";
import workshop from "@/assets/workshop.jpg";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — BikeTime" },
      { name: "description", content: "Conheça a história da BikeTime, oficina premium dedicada à alta performance." },
      { property: "og:title", content: "Sobre — BikeTime" },
      { property: "og:description", content: "Oficina premium dedicada à alta performance." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div>
      <section className="container-px mx-auto grid max-w-7xl gap-12 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Sobre</span>
          <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
            Mais que uma loja, uma <span className="text-gradient-yellow">paixão</span> pelo ciclismo.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            A Bike Time nasceu em 1999 com um sonho: transformar a paixão pelo ciclismo em uma
            experiência única para ciclistas de todos os níveis. O que começou como uma pequena
            bicicletaria de bairro, com apenas 8 bicicletas – 4 delas do próprio fundador, Zé Maria –
            rapidamente se tornou sinônimo de qualidade, inovação e amor pelo pedal.
          </p>
          <p className="mt-4 text-muted-foreground">
            Desde o início, a Bike Time acreditou na bicicleta como mais do que um meio de transporte.
            Ela é um estilo de vida! E foi essa paixão que nos tornou o primeiro Shimano Service Center
            de São Paulo em 2011. Com um serviço técnico especializado e comprometido, garantimos que
            cada pedalada seja segura, prazerosa e inesquecível.
          </p>
          <p className="mt-4 text-muted-foreground">
            Mas nossa história não para por aí. Em 2020, a Bike Time ganhou um novo líder, Fábio Tavares,
            que trouxe uma visão moderna e um compromisso renovado com a comunidade. Cliente de longa
            data e amigo de Zé Maria, Fábio assumiu o desafio de continuar o legado enquanto escrevia
            um novo capítulo. E ele foi além: ao lado da equipe Bike Time, criou o One9 Social, um
            projeto que transforma bicicletas antigas em sorrisos, doando-as para crianças carentes e
            incentivando o esporte desde cedo.
          </p>
          <p className="mt-4 text-muted-foreground">
            Hoje, a Bike Time é muito mais do que uma loja. Somos um ponto de encontro para ciclistas,
            uma porta de entrada para o mundo do ciclismo e um agente de transformação na comunidade.
            Oferecemos passeios organizados, competições e eventos que fortalecem laços e aproximam as
            pessoas desse universo incrível.
          </p>
          <p className="mt-4 text-muted-foreground">
            Seja para escolher sua próxima bike, equipar-se com os melhores acessórios ou simplesmente
            compartilhar histórias de pedal, a Bike Time está aqui para você. Venha fazer parte dessa
            jornada, onde cada pedalada é um passo para um futuro mais sustentável, ativo e feliz.
          </p>
          <p className="mt-6 font-display text-lg font-semibold text-primary">
            Bike Time: Mais que uma loja, uma paixão pelo ciclismo!
          </p>
        </div>
        <div className="relative">
          <img
            src={workshop}
            alt="Oficina BikeTime"
            loading="lazy"
            width={1280}
            height={896}
            className="aspect-[4/5] w-full rounded-2xl object-cover"
          />
        </div>
      </section>

      <section className="border-y border-border bg-surface/40">
        <div className="container-px mx-auto grid max-w-7xl gap-6 py-20 md:grid-cols-3">
          {[
            { icon: Target, title: "Missão", desc: "Elevar a experiência do ciclista através de técnica, tecnologia e atendimento de excelência." },
            { icon: Heart, title: "Visão", desc: "Ser referência nacional em oficina premium de bicicletas de alta performance." },
            { icon: Trophy, title: "Valores", desc: "Precisão, transparência, paixão pelo esporte e respeito pelo cliente." },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-background p-8">
              <v.icon className="text-primary" size={26} />
              <h3 className="mt-4 font-display text-xl font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
