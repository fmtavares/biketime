import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { calcBike, fmtBRL, fmtPct, type FinancialSettings } from "@/lib/finance";
import { Search, Boxes, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/vendas/estoque")({ component: EstoquePage });

const statusLabel: Record<string, string> = {
  em_estoque: "Em estoque", reservada: "Reservada", vendida: "Vendida",
  em_montagem: "Em montagem", em_transito: "Em trânsito", consignada: "Consignada",
};

function EstoquePage() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["bikes-estoque-list"],
    queryFn: async () => {
      const [{ data: bikes }, { data: settings }] = await Promise.all([
        supabase.from("bikes_estoque").select("*").order("created_at", { ascending: false }),
        supabase.from("financial_settings").select("*").limit(1).maybeSingle(),
      ]);
      return { bikes: bikes ?? [], settings: settings as unknown as FinancialSettings };
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.bikes.filter((b: any) => {
      const matchesQ = !q || `${b.marca} ${b.modelo} ${b.sku ?? ""} ${b.numero_serie ?? ""}`.toLowerCase().includes(q.toLowerCase());
      const matchesStatus = !statusFilter || b.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [data, q, statusFilter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Estoque</h1>
          <p className="text-sm text-muted-foreground">{data?.bikes.length ?? 0} cadastradas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" variant="outline">
            <Link to="/vendas">
              <Boxes className="h-4 w-4" />
              Dashboard
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

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca, modelo, SKU…" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border bg-background px-3 text-sm">
          <option value="">Todos status</option>
          {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhuma bike encontrada.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((b: any) => {
            const c = data ? calcBike({ ...b, settings: data.settings }) : null;
            const dias = Math.floor((Date.now() - new Date(b.data_entrada).getTime()) / 86400000);
            const isSeminova = b.condicao === "seminova";
            return (
              <Link key={b.id} to="/vendas/$id" params={{ id: b.id }}>
                <Card className={`transition hover:border-foreground ${isSeminova ? "border-blue-500 bg-blue-500/5" : ""}`}>
                  <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{b.marca} {b.modelo}</span>
                        <Badge variant="secondary">{statusLabel[b.status]}</Badge>
                        {isSeminova && <Badge className="bg-blue-600 text-white hover:bg-blue-600">Seminova</Badge>}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {b.sku && <>SKU {b.sku} · </>}{b.tamanho && <>Tam {b.tamanho} · </>}{b.ano && <>{b.ano}</>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-muted-foreground">Venda</div>
                      <div className="font-semibold">{c ? fmtBRL(c.venda) : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-muted-foreground">Margem</div>
                      <div className={`font-semibold ${c && c.margem_pct < 0 ? "text-destructive" : c && c.margem_pct < 10 ? "text-blue-600 dark:text-blue-400" : ""}`}>{c ? fmtPct(c.margem_pct) : "—"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase text-muted-foreground">Estoque</div>
                      <div className="font-semibold">{dias}d</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
