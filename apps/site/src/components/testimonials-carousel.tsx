import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Testimonial = {
  id: string;
  name: string;
  role: string | null;
  photo_url: string;
  quote: string;
};

export function TestimonialsCarousel() {
  const [items, setItems] = useState<Testimonial[] | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("testimonials")
      .select("id, name, role, photo_url, quote")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("[testimonials] load failed", error);
          setItems([]);
          return;
        }
        setItems((data ?? []) as Testimonial[]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  // Duplicate the list for a seamless infinite marquee
  const loop = [...items, ...items];

  return (
    <section
      aria-label="Depoimentos de clientes"
      className="container-px mx-auto max-w-7xl py-20 md:py-28"
    >
      <div className="mb-12 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          / Depoimentos
        </span>
        <h2 className="mt-3 font-display text-4xl font-bold md:text-5xl">
          Quem pedala com a gente.
        </h2>
        <p className="mt-4 text-muted-foreground">
          A confiança de quem leva o ciclismo a sério — histórias reais de ciclistas atendidos
          pela BikeTime.
        </p>
      </div>

      <div
        className="group/marquee relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="flex w-max gap-6 animate-marquee group-hover/marquee:[animation-play-state:paused]">
          {loop.map((t, i) => (
            <article
              key={`${t.id}-${i}`}
              aria-hidden={i >= items.length ? "true" : undefined}
              className="relative flex h-full w-[320px] shrink-0 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:border-primary/40 md:w-[380px]"
            >
              <Quote className="absolute right-6 top-6 h-8 w-8 text-primary/20" />
              <p className="text-sm leading-relaxed text-foreground/90">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-white/5">
                  {t.photo_url ? (
                    <img
                      src={t.photo_url}
                      alt={t.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                      {t.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-foreground">{t.name}</div>
                  {t.role && (
                    <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">
                      {t.role}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
