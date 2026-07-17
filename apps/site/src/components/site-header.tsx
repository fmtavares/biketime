import { Link } from "@tanstack/react-router";
import { Menu, User, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const links = [
  { to: "/", label: "Home" },
  { to: "/sobre", label: "Sobre" },
  { to: "/servicos", label: "Serviços" },
  { to: "/delivery", label: "Delivery" },
  { to: "/equipe", label: "Equipe" },
  { to: "/eventos", label: "Eventos" },
  { to: "/contato", label: "Contato" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link to="/" className="group flex items-center" aria-label="BikeTime">
          <img src={logo} alt="BikeTime" width={44} height={44} className="h-11 w-11 transition-transform group-hover:scale-105" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: l.to === "/" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground opacity-60"
                  >
                    <User size={16} /> Login
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Em breve</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-2 text-foreground md:hidden"
          aria-label="Menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="container-px mx-auto flex max-w-7xl flex-col py-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/40 py-3 text-sm font-medium text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="mt-4 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-foreground opacity-60"
            >
              <User size={16} /> Login (em breve)
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
