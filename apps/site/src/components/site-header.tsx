import { Link, useNavigate } from "@tanstack/react-router";
import { CircleUser, LogOut, Menu, Store, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

/** Links à esquerda do Showroom no menu. */
const linksAntes = [
  { to: "/", label: "Home" },
  { to: "/sobre", label: "Sobre" },
  { to: "/servicos", label: "Serviços" },
  { to: "/delivery", label: "Delivery" },
] as const;

/** Links à direita do Showroom no menu. */
const linksDepois = [
  { to: "/equipe", label: "Equipe" },
  { to: "/eventos", label: "Eventos" },
  { to: "/contato", label: "Contato" },
] as const;

/** Lista completa na ordem do menu (mobile e desktop). */
const links = [
  ...linksAntes,
  { to: "/loja", label: "Showroom", featured: true as const },
  ...linksDepois,
];

/**
 * Renderiza um link comum do menu (sem destaque).
 */
function NavLink({
  to,
  label,
  onNavigate,
  mobile = false,
}: {
  to: string;
  label: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <Link
        to={to}
        onClick={onNavigate}
        className="border-b border-border/40 py-3 text-sm font-medium text-foreground"
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      to={to}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "text-foreground" }}
      activeOptions={{ exact: to === "/" }}
    >
      {label}
    </Link>
  );
}

/**
 * Link destacado do Showroom (ícone + label) no centro do menu.
 * Usa o amarelo primary da marca para chamar atenção sem sair da identidade.
 */
function ShowroomLink({
  onNavigate,
  mobile = false,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <Link
        to="/loja"
        onClick={onNavigate}
        className="my-1 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Store size={16} strokeWidth={1.75} />
        Showroom
      </Link>
    );
  }

  return (
    <Link
      to="/loja"
      aria-label="Showroom"
      title="Showroom"
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_oklch(0.87_0.18_95_/_0.55)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
      activeProps={{
        className:
          "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground ring-2 ring-primary/50 shadow-[0_0_24px_-4px_oklch(0.87_0.18_95_/_0.7)]",
      }}
    >
      <Store size={15} strokeWidth={1.75} />
      Showroom
    </Link>
  );
}

/**
 * Cabeçalho do site: navegação (com Showroom destacado), Login / Minha conta e Sair.
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

        <nav className="hidden items-center gap-5 lg:gap-7 md:flex">
          {linksAntes.map((l) => (
            <NavLink key={l.to} to={l.to} label={l.label} />
          ))}
          <ShowroomLink />
          {linksDepois.map((l) => (
            <NavLink key={l.to} to={l.to} label={l.label} />
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
            {links.map((l) =>
              "featured" in l && l.featured ? (
                <ShowroomLink key={l.to} mobile onNavigate={() => setOpen(false)} />
              ) : (
                <NavLink
                  key={l.to}
                  to={l.to}
                  label={l.label}
                  mobile
                  onNavigate={() => setOpen(false)}
                />
              ),
            )}
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
