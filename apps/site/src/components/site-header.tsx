import { Link, useNavigate } from "@tanstack/react-router";
import { CircleUser, LogOut, Menu, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Home" },
  { to: "/sobre", label: "Sobre" },
  { to: "/servicos", label: "Serviços" },
  { to: "/delivery", label: "Delivery" },
  { to: "/equipe", label: "Equipe" },
  { to: "/eventos", label: "Eventos" },
  { to: "/contato", label: "Contato" },
] as const;

/**
 * Cabeçalho do site: navegação, Login / Minha conta e Sair (quando logado).
 */
export function SiteHeader() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    /** Atualiza o estado visual conforme a sessão Auth. */
    function aplicarSessao(temUsuario: boolean) {
      setLogado(temUsuario);
    }

    supabase.auth.getSession().then(({ data }) => {
      aplicarSessao(Boolean(data.session?.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      aplicarSessao(Boolean(session?.user));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /** Encerra a sessão e envia o usuário para a tela de login. */
  async function sair() {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="container-px mx-auto flex h-16 max-w-7xl items-center justify-between">
        <Link to="/" className="group flex items-center" aria-label="BikeTime">
          <img
            src={logo}
            alt="BikeTime"
            width={44}
            height={44}
            className="h-11 w-11 transition-transform group-hover:scale-105"
          />
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

        <div className="hidden items-center gap-2 md:flex">
          {logado ? (
            <>
              {/* Ícone só — verde suave indica sessão ativa e leva à Minha conta */}
              <Link
                to="/minha-conta"
                aria-label="Minha conta"
                title="Minha conta"
                className="inline-flex size-9 items-center justify-center rounded-full text-[#8fbc8f] transition-colors hover:bg-[#8fbc8f]/10 hover:text-[#a8d0a8]"
              >
                <CircleUser size={22} strokeWidth={1.75} />
              </Link>
              <button
                type="button"
                onClick={sair}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Sair da conta"
              >
                <LogOut size={15} /> Sair
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <User size={16} /> Login
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {logado && (
            <Link
              to="/minha-conta"
              aria-label="Minha conta"
              title="Minha conta"
              className="inline-flex size-9 items-center justify-center rounded-full text-[#8fbc8f] transition-colors hover:bg-[#8fbc8f]/10"
            >
              <CircleUser size={22} strokeWidth={1.75} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-2 text-foreground"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
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
            {!logado && (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-semibold text-foreground"
              >
                <User size={16} /> Login
              </Link>
            )}
            {logado && (
              <button
                type="button"
                onClick={sair}
                className="mt-4 inline-flex items-center justify-center gap-2 py-2 text-sm font-medium text-muted-foreground"
              >
                <LogOut size={15} /> Sair
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
