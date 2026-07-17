import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { DollarSign, Wrench, Bike, Users, TrendingUp, Crown } from "lucide-react";

export const Route = createFileRoute("/_app/relatorios")({
  component: Relatorios,
});

function Stat({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="rounded-xl border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wider">{label}</span>
        <Icon className="size-4" />
      </div>
      <div className="mt-3 text-3xl font-display font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Relatorios() {
  const { isAdmin, loading } = useAuth();

  const { data } = useQuery({
    queryKey: ["relatorios"],
    queryFn: async () => {
      const [os, clientes, bikes] = await Promise.all([
        supabase.from("ordens_servico").select("*"),
        supabase.from("clientes").select("id, vip, origem_lead, created_at"),
        supabase.from("bikes").select("id, marca, status"),
      ]);
      return { os: os.data ?? [], clientes: clientes.data ?? [], bikes: bikes.data ?? [] };
    },
    enabled: isAdmin,
  });

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const ordens = data?.os ?? [];
  const valorOS = (o: any) =>
    Number(o.valor_aprovado ?? Number(o.valor_pecas ?? 0) + Number(o.valor_mao_obra ?? 0));

  // Resumo financeiro = mês corrente
  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const noMesAtual = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  };
  const dataPaga = (o: any) => o.data_pagamento ?? o.data_entrega ?? o.data_conclusao ?? o.created_at;
  const dataEntregue = (o: any) => o.data_entrega ?? o.data_conclusao ?? o.created_at;

  const pagas = ordens.filter((o) => o.status === "pago" && noMesAtual(dataPaga(o)));
  const aReceberOS = ordens.filter(
    (o) => (o.status === "entregue" || o.status === "finalizada") && noMesAtual(dataEntregue(o)),
  );
  const recebido = pagas.reduce((s, o) => s + valorOS(o), 0);
  const aReceber = aReceberOS.reduce((s, o) => s + valorOS(o), 0);
  const faturamento = recebido + aReceber;
  const entregues = [...pagas, ...aReceberOS];
  const totalServico = entregues.reduce((s, o) => s + Number(o.valor_mao_obra ?? 0), 0);
  const totalPecas = entregues.reduce((s, o) => s + Number(o.valor_pecas ?? 0), 0);
  const mesLabel = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Origem dos leads
  const origens: Record<string, number> = {};
  (data?.clientes ?? []).forEach((c) => {
    const k = c.origem_lead ?? "Sem origem";
    origens[k] = (origens[k] ?? 0) + 1;
  });

  // Marcas mais comuns
  const marcas: Record<string, number> = {};
  (data?.bikes ?? []).forEach((b) => {
    marcas[b.marca] = (marcas[b.marca] ?? 0) + 1;
  });
  const topMarcas = Object.entries(marcas).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOrigens = Object.entries(origens).sort((a, b) => b[1] - a[1]);

  // Status breakdown
  const statusCount: Record<string, number> = {};
  ordens.forEach((o) => (statusCount[o.status] = (statusCount[o.status] ?? 0) + 1));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Relatórios" description="Indicadores da operação" />

      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Resumo financeiro · <span className="capitalize">{mesLabel}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">

        <Stat
          icon={DollarSign}
          label="Faturamento total"
          value={`R$ ${faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`${entregues.length} OS`}
        />
        <Stat
          icon={Wrench}
          label="Total serviço"
          value={`R$ ${totalServico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <Stat
          icon={Bike}
          label="Total peças"
          value={`R$ ${totalPecas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <Stat
          icon={DollarSign}
          label="Recebido"
          value={`R$ ${recebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`${pagas.length} OS pagas`}
        />
        <Stat
          icon={TrendingUp}
          label="A receber"
          value={`R$ ${aReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`${aReceberOS.length} OS entregues`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            <Wrench className="size-4" /> OS por status
          </h3>
          <div className="space-y-2">
            {Object.entries(statusCount).map(([k, v]) => {
              const pct = ordens.length ? (v / ordens.length) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {ordens.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            <Users className="size-4" /> Origem dos leads
          </h3>
          <div className="space-y-2">
            {topOrigens.map(([k, v]) => {
              const pct = (data?.clientes.length ?? 0) ? (v / data!.clientes.length) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{k}</span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {topOrigens.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            <Bike className="size-4" /> Top marcas
          </h3>
          <div className="space-y-2">
            {topMarcas.map(([k, v]) => (
              <div key={k} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                <span className="font-medium">{k}</span>
                <span className="text-muted-foreground">{v} bikes</span>
              </div>
            ))}
            {topMarcas.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            <Crown className="size-4 text-accent" /> Clientes
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Users} label="Total" value={data?.clientes.length ?? 0} />
            <Stat icon={Crown} label="VIPs" value={(data?.clientes ?? []).filter((c) => c.vip).length} />
          </div>
        </div>
      </div>
    </div>
  );
}
