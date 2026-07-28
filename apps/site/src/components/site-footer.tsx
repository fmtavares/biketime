import { Instagram, MapPin, MessageCircle, Phone } from "lucide-react";

const WA_URL = "https://wa.me/5511961680346";
const IG_URL = "https://instagram.com/bike.time";
const TEL_URL = "tel:+5511961680346";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Bike+Time+Perdizes";

/**
 * Rodapé mínimo: só contato útil, centralizado.
 * Sem logo (já no header sticky), sem navegação e sem copyright.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface/40">
      <div className="container-px mx-auto flex max-w-7xl justify-center py-6 text-xs text-muted-foreground">
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <li>
            <a
              href={TEL_URL}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <Phone size={12} className="shrink-0 text-primary" />
              11 96168-0346
            </a>
          </li>
          <li>
            <a
              href={WA_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <MessageCircle size={12} className="shrink-0 text-primary" />
              WhatsApp
            </a>
          </li>
          <li>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <MapPin size={12} className="shrink-0 text-primary" />
              Perdizes · SP
            </a>
          </li>
          <li>
            <a
              href={IG_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              <Instagram size={12} className="shrink-0 text-primary" />
              @bike.time
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
