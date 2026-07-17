import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Instagram, Trophy, X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — BikeTime" },
      { name: "description", content: "Pedais, workshops e encontros da comunidade BikeTime." },
      { property: "og:title", content: "Eventos — BikeTime" },
      { property: "og:description", content: "Pedais, workshops e encontros da comunidade BikeTime." },
    ],
  }),
  component: EventosPage,
});

type PastEventRow = {
  id: string;
  name: string;
  description: string;
  event_date: string;
  photos: string[];
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .replace(/^./, (c) => c.toUpperCase());
}

function EventosPage() {
  const [selectedEvent, setSelectedEvent] = useState<PastEventRow | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const { data: pastEvents, isLoading } = useQuery({
    queryKey: ["public-past-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("past_events")
        .select("id,name,description,event_date,photos")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PastEventRow[];
    },
  });

  const openGallery = (evt: PastEventRow) => {
    setSelectedEvent(evt);
    setCurrentPhotoIndex(0);
  };

  const closeGallery = () => {
    setSelectedEvent(null);
    setCurrentPhotoIndex(0);
  };

  const goNext = () => {
    if (!selectedEvent) return;
    setCurrentPhotoIndex((i) => (i + 1) % selectedEvent.photos.length);
  };

  const goPrev = () => {
    if (!selectedEvent) return;
    setCurrentPhotoIndex((i) => (i - 1 + selectedEvent.photos.length) % selectedEvent.photos.length);
  };

  return (
    <div>
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Eventos</span>
        <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
          Comunidade que <span className="text-gradient-yellow">pedala junto.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Pedais, workshops e encontros para conectar quem vive o ciclismo de verdade.
        </p>

        {/* Em breve */}
        <div className="mt-14 overflow-hidden rounded-2xl border border-border bg-surface/60 p-8 md:p-12">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
                <Calendar size={14} /> Em breve
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold md:text-4xl">
                Novos eventos serão divulgados por aqui.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Estamos preparando os próximos pedais, workshops e ações da BikeTime.
                Acompanhe nossas redes para não perder nenhuma novidade.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <a
                href="https://instagram.com/bike.time"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:shadow-[var(--shadow-glow)]"
              >
                <Instagram size={16} /> @bike.time
              </a>
              <a
                href="https://wa.me/5511961680346"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Eventos realizados */}
        <div className="mt-20">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">/ Já rolou</span>
          <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Eventos realizados</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Um pouco da história que construímos com a nossa comunidade.
          </p>

          {isLoading ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl border border-border bg-surface/60" />
              ))}
            </div>
          ) : !pastEvents || pastEvents.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center text-muted-foreground">
              Em breve compartilharemos os eventos que já realizamos.
            </div>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pastEvents.map((evt) => {
                const cover = evt.photos?.[0];
                const photoCount = evt.photos?.length ?? 0;
                return (
                  <article
                    key={evt.id}
                    onClick={() => openGallery(evt)}
                    className="hover-lift cursor-pointer overflow-hidden rounded-2xl border border-border bg-surface/60"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br from-surface-elevated to-background">
                      {cover ? (
                        <img
                          src={cover}
                          alt={evt.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Trophy size={56} className="text-primary/40" strokeWidth={1.25} />
                      )}
                      <div className="absolute left-4 top-4 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-foreground backdrop-blur">
                        {formatDate(evt.event_date)}
                      </div>
                      {photoCount > 1 && (
                        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur">
                          <ImageIcon size={14} /> {photoCount}
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-lg font-semibold">{evt.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{evt.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Gallery Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && closeGallery()}>
        <DialogContent
          className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-background/95 p-0 backdrop-blur sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[95vh] sm:w-[95vw] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:border [&>button]:hidden"
        >
          <VisuallyHidden>
            <DialogTitle>{selectedEvent?.name ?? "Galeria"}</DialogTitle>
          </VisuallyHidden>
          {selectedEvent && (
            <div className="flex h-full w-full flex-col overflow-hidden">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-base font-bold sm:text-xl">{selectedEvent.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    {formatDate(selectedEvent.event_date)} &bull; {selectedEvent.photos.length} foto{selectedEvent.photos.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={closeGallery}
                  className="shrink-0 rounded-full p-2 transition-colors hover:bg-muted"
                  aria-label="Fechar"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Photo viewer */}
              <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-black/90">
                {selectedEvent.photos.length > 0 ? (
                  <>
                    <img
                      src={selectedEvent.photos[currentPhotoIndex]}
                      alt={`${selectedEvent.name} — foto ${currentPhotoIndex + 1}`}
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    {selectedEvent.photos.length > 1 && (
                      <>
                        <button
                          onClick={goPrev}
                          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur transition-colors hover:bg-background sm:left-4"
                          aria-label="Anterior"
                        >
                          <ChevronLeft size={24} />
                        </button>
                        <button
                          onClick={goNext}
                          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur transition-colors hover:bg-background sm:right-4"
                          aria-label="Próxima"
                        >
                          <ChevronRight size={24} />
                        </button>
                        <div className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur sm:bottom-4 sm:text-sm">
                          {currentPhotoIndex + 1} / {selectedEvent.photos.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <ImageIcon size={48} className="opacity-40" />
                    <p>Sem fotos para este evento.</p>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {selectedEvent.photos.length > 1 && (
                <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-border p-3 sm:p-4">
                  {selectedEvent.photos.map((photo, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPhotoIndex(idx)}
                      className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-16 sm:w-16 ${
                        idx === currentPhotoIndex
                          ? "border-primary"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Miniatura ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="hidden shrink-0 border-t border-border px-4 py-3 sm:block sm:px-6 sm:py-4">
                  <p className="line-clamp-3 text-xs text-muted-foreground sm:text-sm">{selectedEvent.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
