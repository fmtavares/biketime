import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  Bike,
  Wrench,
  LogOut,
  Search,
  BarChart3,
  Settings,
  ShieldCheck,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import bikeTimeLogo from "@/assets/biketime-logo.png";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
type NavSection = { label?: string; items: NavItem[] };

const dashboardSection: NavSection = {
  items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
};

const oficinaSection: NavSection = {
  label: "Gestão da Oficina",
  items: [
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/bikes", label: "Bikes", icon: Bike },
    { to: "/oficina", label: "Oficina", icon: Wrench },
  ],
};

const vendasSection: NavSection = {
  label: "Vendas",
  items: [
    { to: "/vendas", label: "Vendas", icon: ShoppingCart },
    { to: "/vendas/estoque", label: "Bikes", icon: Bike },
    { to: "/vendas/produtos", label: "Produtos", icon: Package },
    { to: "/marketing", label: "Marketing", icon: Sparkles },
  ],
};

const fornecedoresSection: NavSection = {
  label: "Fornecedores",
  items: [
    { to: "/fornecedores", label: "Fornecedores", icon: Truck },
    { to: "/compras", label: "Compras", icon: Receipt },
    { to: "/contas-a-pagar", label: "A Pagar", icon: Wallet },
  ],
};

const financeiroSection: NavSection = {
  label: "Financeiro",
  items: [
    { to: "/despesas", label: "Despesas", icon: CircleDollarSign },
  ],
};

const organizacaoSectionAdmin: NavSection = {
  label: "Organização",
  items: [
    { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/precos", label: "Preços", icon: DollarSign },
    { to: "/pendencias", label: "Pendências", icon: ListChecks },
  ],
};

const organizacaoSectionUser: NavSection = {
  label: "Organização",
  items: [
    { to: "/precos", label: "Preços", icon: DollarSign },
    { to: "/pendencias", label: "Pendências", icon: ListChecks },
  ],
};

const configSection: NavSection = {
  label: "Configurações",
  items: [{ to: "/configuracoes", label: "Configurações", icon: Settings }],
};

export function AppLayout() {
  const { user, loading, signOut, isAdmin } = useAuth();
  const sections: NavSection[] = isAdmin
    ? [
        dashboardSection,
        oficinaSection,
        vendasSection,
        fornecedoresSection,
        financeiroSection,
        organizacaoSectionAdmin,
        configSection,
      ]
    : [dashboardSection, oficinaSection, organizacaoSectionUser];
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  const allNavItems = sections.flatMap((s) => s.items);

  /**
   * Destaca só o item de nav mais específico (ex.: /vendas/produtos → Produtos, não Vendas).
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

  const navItems = (onClick?: () => void) =>
    sections.map((section, idx) => (
      <div key={section.label ?? `section-${idx}`} className={idx > 0 ? "pt-3 mt-3 border-t border-border/50" : ""}>
        {section.label && (
          <div className="px-3 pb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {section.label}
          </div>
        )}
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
      </div>
    ));

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r bg-sidebar flex-col">
        <div className="px-5 py-5 border-b flex items-center gap-2">
          <img src={bikeTimeLogo} alt="Bike Time" className="size-10 rounded-full object-cover" />
          <div>
            <div className="font-display font-bold leading-tight">Bike Time</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              CRM + Oficina
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">{navItems()}</nav>

        <div className="p-3 border-t">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">
            {user.email}
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-14 border-b bg-sidebar">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={bikeTimeLogo} alt="Bike Time" className="size-8 rounded-full object-cover" />
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
              <img src={bikeTimeLogo} alt="Bike Time" className="size-10 rounded-full object-cover" />
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
              <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
                <LogOut className="size-4" /> Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-x-hidden">
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
      {action && <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}
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
