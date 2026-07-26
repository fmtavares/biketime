import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  Bike,
  LogOut,
  Search,
  BarChart3,
  Sparkles,
  Menu,
  DollarSign,
  ShoppingCart,
  ListChecks,
  Package,
  Truck,
  Receipt,
  Wallet,
  CircleDollarSign,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  ClipboardList,
  Columns3,
  Tag,
  SlidersHorizontal,
  UsersRound,
  Plus,
  Store,
  BookOpenCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import bikeTimeLogo from "@/assets/biketime-logo.png";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavSection = { id: string; label?: string; items: NavItem[] };

const LS_COLLAPSED = "bt-gestao-nav-collapsed";
const LS_SIDEBAR_HIDDEN = "bt-gestao-sidebar-hidden";

const dashboardSection: NavSection = {
  id: "dashboard",
  items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
};

const clientesSection: NavSection = {
  id: "clientes",
  label: "Clientes",
  items: [
    { to: "/clientes", label: "Clientes", icon: Users, exact: true },
    { to: "/clientes/nova", label: "Novo Cliente", icon: Plus },
    { to: "/bikes", label: "Bikes", icon: Bike },
  ],
};

const oficinaSection: NavSection = {
  id: "oficina",
  label: "Oficina",
  items: [
    { to: "/oficina", label: "Painel", icon: Columns3, exact: true },
    { to: "/oficina/ordens", label: "Ordens de Serviço", icon: ClipboardList },
    { to: "/oficina/nova", label: "Nova Ordem", icon: Plus },
  ],
};

const estoqueSection: NavSection = {
  id: "estoque",
  label: "Estoque",
  items: [
    { to: "/vendas/produtos", label: "Produtos", icon: Package },
    { to: "/vendas/estoque", label: "Bikes", icon: Bike },
    { to: "/fornecedores", label: "Fornecedores", icon: Truck },
    { to: "/compras", label: "Compras", icon: Receipt },
  ],
};

const vendasSection: NavSection = {
  id: "vendas",
  label: "Vendas",
  items: [
    { to: "/vendas", label: "Gestão", icon: ShoppingCart, exact: true },
    { to: "/vendas/loja-virtual", label: "Loja Virtual", icon: Store },
    { to: "/marketing", label: "Marketing", icon: Sparkles },
  ],
};

const financeiroSection: NavSection = {
  id: "financeiro",
  label: "Financeiro",
  items: [
    { to: "/contas-a-pagar", label: "A Pagar", icon: Wallet },
    { to: "/despesas", label: "Despesas", icon: CircleDollarSign },
    { to: "/fechamento", label: "Fechamento", icon: BookOpenCheck },
  ],
};

const organizacaoSectionAdmin: NavSection = {
  id: "organizacao",
  label: "Organização",
  items: [
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/pendencias", label: "Pendências", icon: ListChecks },
  ],
};

const organizacaoSectionUser: NavSection = {
  id: "organizacao",
  label: "Organização",
  items: [
    { to: "/pendencias", label: "Pendências", icon: ListChecks },
  ],
};

const configSectionAdmin: NavSection = {
  id: "config",
  label: "Configurações",
  items: [
    { to: "/configuracoes", label: "Usuários", icon: UsersRound },
    { to: "/precos", label: "Preços", icon: DollarSign },
    { to: "/marcas", label: "Marcas de bikes", icon: Tag },
    { to: "/tipos-atividade", label: "Tipos de atividade", icon: ListChecks },
    { to: "/parametros-financeiros", label: "Parâmetros financeiros", icon: SlidersHorizontal },
  ],
};

const configSectionUser: NavSection = {
  id: "config",
  label: "Configurações",
  items: [
    { to: "/precos", label: "Preços", icon: DollarSign },
    { to: "/marcas", label: "Marcas de bikes", icon: Tag },
  ],
};

/**
 * Lê do localStorage o mapa de seções recolhidas.
 */
function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LS_COLLAPSED);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

/**
 * Layout autenticado: sidebar com seções recolhíveis e opção de tela cheia.
 */
export function AppLayout() {
  const { user, loading, signOut, isAdmin } = useAuth();
  const sections: NavSection[] = isAdmin
    ? [
        dashboardSection,
        clientesSection,
        oficinaSection,
        estoqueSection,
        vendasSection,
        financeiroSection,
        organizacaoSectionAdmin,
        configSectionAdmin,
      ]
    : [
        dashboardSection,
        clientesSection,
        oficinaSection,
        organizacaoSectionUser,
        configSectionUser,
      ];
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    typeof window !== "undefined" ? loadCollapsed() : {},
  );
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_SIDEBAR_HIDDEN) === "1";
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    localStorage.setItem(LS_COLLAPSED, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(LS_SIDEBAR_HIDDEN, sidebarHidden ? "1" : "0");
  }, [sidebarHidden]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const allNavItems = sections.flatMap((s) => s.items);

  /**
   * Destaca só o item de nav mais específico (ex.: /oficina/ordens → Ordens, não Painel).
   */
  function isNavActive(item: NavItem): boolean {
    const matches = (i: NavItem) =>
      i.exact ? path === i.to : path === i.to || path.startsWith(`${i.to}/`);
    if (!matches(item)) return false;
    const best = allNavItems
      .filter(matches)
      .reduce((a, b) => (a.to.length >= b.to.length ? a : b));
    return best.to === item.to;
  }

  /**
   * Alterna recolher/expandir um bloco do menu.
   */
  function toggleSection(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  /**
   * Bloco de navegação (desktop ou drawer mobile).
   */
  const navItems = (onClick?: () => void) =>
    sections.map((section, idx) => {
      const hasLabel = !!section.label;
      const isCollapsed = hasLabel && !!collapsed[section.id];
      const sectionHasActive = section.items.some((item) => isNavActive(item));

      return (
        <div
          key={section.id}
          className={idx > 0 ? "pt-3 mt-3 border-t border-border/50" : ""}
        >
          {hasLabel && (
            <button
              type="button"
              onClick={() => toggleSection(section.id)}
              className={`w-full flex items-center justify-between gap-2 px-3 pb-1.5 text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                sectionHasActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-expanded={!isCollapsed}
            >
              <span>{section.label}</span>
              <ChevronDown
                className={`size-3.5 shrink-0 transition-transform ${
                  isCollapsed ? "-rotate-90" : ""
                }`}
              />
            </button>
          )}
          {!isCollapsed && (
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(item);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onClick}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Desktop sidebar */}
      {!sidebarHidden && (
        <aside className="hidden lg:flex w-60 shrink-0 border-r bg-sidebar flex-col">
          <div className="px-5 py-5 border-b flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={bikeTimeLogo}
                alt="Bike Time"
                className="size-10 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <div className="font-display font-bold leading-tight truncate">
                  Bike Time
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  CRM + Oficina
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Esconder menu"
              title="Esconder menu"
              onClick={() => setSidebarHidden(true)}
            >
              <PanelLeftClose className="size-4" />
            </Button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">{navItems()}</nav>

          <div className="p-3 border-t">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate">
              {user.email}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={signOut}
            >
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </aside>
      )}

      {/* Botão flutuante para reabrir o menu (desktop) */}
      {sidebarHidden && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="hidden lg:flex fixed left-3 top-3 z-40 shadow-md"
          aria-label="Mostrar menu"
          title="Mostrar menu"
          onClick={() => setSidebarHidden(false)}
        >
          <PanelLeft className="size-4" />
        </Button>
      )}

      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-14 border-b bg-sidebar">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img
            src={bikeTimeLogo}
            alt="Bike Time"
            className="size-8 rounded-full object-cover"
          />
          <span className="font-display font-bold truncate">Bike Time</span>
        </Link>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0 flex flex-col bg-sidebar">
            <div className="px-5 py-5 border-b flex items-center gap-2">
              <img
                src={bikeTimeLogo}
                alt="Bike Time"
                className="size-10 rounded-full object-cover"
              />
              <div>
                <div className="font-display font-bold leading-tight">Bike Time</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  CRM + Oficina
                </div>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems(() => setMobileOpen(false))}
            </nav>
            <div className="p-3 border-t">
              <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                {user.email}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={signOut}
              >
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-x-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-display font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && (
        <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">
          {action}
        </div>
      )}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
