import { Link } from "@tanstack/react-router";
import { Instagram, MapPin, MessageCircle, Phone } from "lucide-react";
import logo from "@/assets/logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-surface/40">
      <div className="container-px mx-auto grid max-w-7xl gap-12 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center">
            <img src={logo} alt="BikeTime" width={64} height={64} loading="lazy" className="h-16 w-16" />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Oficina especializada em bicicletas de alta performance. Tecnologia, precisão e
            atendimento profissional para quem leva o ciclismo a sério.
          </p>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
            Navegar
          </h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/servicos" className="hover:text-primary">Serviços</Link></li>
            <li><Link to="/sobre" className="hover:text-primary">Sobre</Link></li>
            <li><Link to="/equipe" className="hover:text-primary">Equipe</Link></li>
            <li><Link to="/eventos" className="hover:text-primary">Eventos</Link></li>
            <li><Link to="/delivery" className="hover:text-primary">Delivery</Link></li>
            <li><Link to="/contato" className="hover:text-primary">Contato</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
            Contato
          </h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-primary" /> 11 96168-0346</li>
            <li className="flex items-center gap-2"><MessageCircle size={14} className="shrink-0 text-primary" /> WhatsApp 24h</li>
            <li className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-primary" /> Rua Dr. Franco da Rocha, 404 — Perdizes · SP</li>
            <li className="flex items-center gap-2"><Instagram size={14} className="shrink-0 text-primary" /> @bike.time</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container-px mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} BikeTime. Todos os direitos reservados.</p>
          <p>Performance · Tecnologia · Precisão</p>
        </div>
      </div>
    </footer>
  );
}
