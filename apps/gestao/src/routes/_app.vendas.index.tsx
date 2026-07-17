import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcBike, fmtBRL, fmtPct, type FinancialSettings } from "@/lib/finance";
import { Bike, TrendingUp, Banknote, Hourglass, Package, AlertTriangle, Boxes, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/vendas/")({ component: VendasDashboard });

function VendasDashboard() {
  const { isAdmin } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["vendas-dashboard"],
    queryFn: async () => {
      const [{ data: bikes }, { data: settings }] = await Promise.all([
        supabase.from("bikes_estoque").select("*"),
        supabase.from("financial_settings").select("*").limit(1).maybeSingle(),
      ]);
      return { bikes: bikes ?? [], settings: settings as unknown as FinancialSettings };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Carregando…</div>;

  const { bikes, settings } = data;
  const calcs = bikes.map((b) => ({ b, c: calcBike({ ...(b as any), settings }) }));
  const emEstoque = calcs.filter((x) => x.b.status === "em_estoque");
  const vendidas = calcs.filter((x) => x.b.status === "vendida");

  const valorEstoque = emEstoque.reduce((s, x) => s + x.c.custo_total, 0);
  const lucroPotencial = emEstoque.reduce((s, x) => s + x.c.lucro, 0);
  const margemMedia = emEstoque.length ? emEstoque.reduce((s, x) => s + x.c.margem_pct, 0) / emEstoque.length : 0;
  const ticketMedio = vendidas.length ? vendidas.reduce((s, x) => s + x.c.venda, 0) / vendidas.length : 0;

  const today = Date.now();
  const diasEstoque = (entrada: string) => Math.floor((today - new Date(entrada).getTime()) / 86400000);
  const paradas = emEstoque.filter((x) => diasEstoque(x.b.data_entrada) > 60);

  const stats = [
    { label: "Bikes em estoque", value: emEstoque.length, icon: Bike },
    { label: "Valor em estoque", value: fmtBRL(valorEstoque), icon: Banknote },
    { label: "Lucro potencial", value: fmtBRL(lucroPotencial), icon: TrendingUp },
    { label: "Margem média", value: fmtPct(margemMedia), icon: TrendingUp },
    { label: "Ticket médio", value: fmtBRL(ticketMedio), icon: Package },
    { label: "Bikes paradas (>60d)", value: paradas.length, icon: AlertTriangle },
  ];

  const byStatus = ["em_estoque","reservada","em_montagem","em_transito","vendida","consignada"]
    .map((s) => ({ s, n: bikes.filter((b: any) => b.status === s).length }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Dashboard de Vendas</h1>
          <p className="text-sm text-muted-foreground">Visão executiva do estoque comercial</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" variant="outline">
            <Link to="/vendas/estoque">
              <Boxes className="h-4 w-4" />
              Ver estoque
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild size="lg">
              <Link to="/vendas/nova">
                <Plus className="h-4 w-4" />
                Nova bike
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-bold">{s.value}</div>
              </div>
              <div className="rounded-lg p-2.5 bg-secondary text-foreground">
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Bikes por status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byStatus.map((row) => (
              <div key={row.s} className="flex items-center justify-between text-sm">
                <span className="capitalize">{row.s.replace("_", " ")}</span>
                <span className="font-semibold">{row.n}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Estoque envelhecido
              <Hourglass className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paradas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma bike parada há mais de 60 dias.</p>}
            {paradas.slice(0, 5).map(({ b }: any) => (
              <Link key={b.id} to="/vendas/$id" params={{ id: b.id }}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-secondary">
                <span className="truncate">{b.marca} {b.modelo}</span>
                <span className="text-xs text-muted-foreground">{diasEstoque(b.data_entrada)}d</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
