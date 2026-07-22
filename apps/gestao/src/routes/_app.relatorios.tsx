import { useMemo, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarRange, DollarSign, Wrench, Bike, Users, TrendingUp, Crown } from "lucide-react";

export const Route = createFileRoute("/_app/relatorios")({
  component: Relatorios,
});

/** Retorna o primeiro dia do mês (00:00). */
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Retorna o último dia do mês (23:59:59). */
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** Converte Date → yyyy-mm-dd para input type=date. */
function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converte yyyy-mm-dd → Date no início do dia. */
function parseStart(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Converte yyyy-mm-dd → Date no fim do dia. */
function parseEnd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

/** Verifica se a data ISO está dentro do período selecionado. */
function inPeriod(iso: string | null | undefined, from: Date, to: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d >= from && d <= to;
}

/**
 * Card de indicador do relatório (valores longos em R$ usam fonte menor para não quebrar).
 */
function Stat({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4 min-w-0" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-[10px] sm:text-xs uppercase tracking-wide truncate">{label}</span>
        <Icon className="size-3.5 sm:size-4 shrink-0" />
      </div>
      <div className="mt-2 text-base sm:text-lg lg:text-xl font-display font-bold tabular-nums leading-tight break-words">
        {value}
      </div>
      {sub && <div className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );
}

function Relatorios() {
  const { isAdmin, loading } = useAuth();

  const mesPadraoFrom = toInputDate(startOfMonth());
  const mesPadraoTo = toInputDate(endOfMonth());

  const [from, setFrom] = useState(mesPadraoFrom);
  const [to, setTo] = useState(mesPadraoTo);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(mesPadraoFrom);
  const [draftTo, setDraftTo] = useState(mesPadraoTo);

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

  const periodo = useMemo(() => {
    const start = parseStart(from);
    const end = parseEnd(to);
    const isMesAtual =
      from === toInputDate(startOfMonth()) && to === toInputDate(endOfMonth());
    const label = isMesAtual
      ? start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : `${start.toLocaleDateString("pt-BR")} — ${end.toLocaleDateString("pt-BR")}`;
    return { start, end, isMesAtual, label };
  }, [from, to]);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const ordens = data?.os ?? [];
  const valorOS = (o: any) =>
    Number(o.valor_aprovado ?? Number(o.valor_pecas ?? 0) + Number(o.valor_mao_obra ?? 0));

  const dataPaga = (o: any) => o.data_pagamento ?? o.data_entrega ?? o.data_conclusao ?? o.created_at;
  const dataEntregue = (o: any) => o.data_entrega ?? o.data_conclusao ?? o.created_at;

  const pagas = ordens.filter((o) => o.status === "pago" && inPeriod(dataPaga(o), periodo.start, periodo.end));
  const aReceberOS = ordens.filter(
    (o) =>
      (o.status === "entregue" || o.status === "finalizada") &&
      inPeriod(dataEntregue(o), periodo.start, periodo.end),
  );
  const recebido = pagas.reduce((s, o) => s + valorOS(o), 0);
  const aReceber = aReceberOS.reduce((s, o) => s + valorOS(o), 0);
  const faturamento = recebido + aReceber;
  const entregues = [...pagas, ...aReceberOS];
  const totalServico = entregues.reduce((s, o) => s + Number(o.valor_mao_obra ?? 0), 0);
  const totalPecas = entregues.reduce((s, o) => s + Number(o.valor_pecas ?? 0), 0);

  const ordensNoPeriodo = ordens.filter((o) =>
    inPeriod(o.data_entrada ?? o.created_at, periodo.start, periodo.end),
  );

  const clientesNoPeriodo = (data?.clientes ?? []).filter((c) =>
    inPeriod(c.created_at, periodo.start, periodo.end),
  );

  // Origem dos leads (clientes criados no período)
  const origens: Record<string, number> = {};
  clientesNoPeriodo.forEach((c) => {
    const k = c.origem_lead ?? "Sem origem";
    origens[k] = (origens[k] ?? 0) + 1;
  });

  // Marcas mais comuns (base completa de bikes)
  const marcas: Record<string, number> = {};
  (data?.bikes ?? []).forEach((b) => {
    marcas[b.marca] = (marcas[b.marca] ?? 0) + 1;
  });
  const topMarcas = Object.entries(marcas).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOrigens = Object.entries(origens).sort((a, b) => b[1] - a[1]);

  // Status breakdown (OS do período)
  const statusCount: Record<string, number> = {};
  ordensNoPeriodo.forEach((o) => (statusCount[o.status] = (statusCount[o.status] ?? 0) + 1));

  /** Abre o dialog com o período atual como rascunho. */
  const openPeriod = () => {
    setDraftFrom(from);
    setDraftTo(to);
    setPeriodOpen(true);
  };

  /** Aplica o período escolhido no dialog. */
  const applyPeriod = () => {
    if (draftFrom > draftTo) return;
    setFrom(draftFrom);
    setTo(draftTo);
    setPeriodOpen(false);
  };

  /** Volta o filtro para o mês corrente. */
  const resetMesAtual = () => {
    const f = toInputDate(startOfMonth());
    const t = toInputDate(endOfMonth());
    setDraftFrom(f);
    setDraftTo(t);
    setFrom(f);
    setTo(t);
    setPeriodOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Relatórios"
        description="Indicadores da operação"
        action={
          <Button variant="outline" onClick={openPeriod}>
            <CalendarRange className="size-4" />
            Selecionar período
          </Button>
        }
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Resumo financeiro ·{" "}
          <span className="capitalize text-foreground font-medium">{periodo.label}</span>
          {periodo.isMesAtual && (
            <span className="ml-2 normal-case tracking-normal text-muted-foreground">(mês atual)</span>
          )}
        </div>
        {!periodo.isMesAtual && (
          <button
            type="button"
            onClick={resetMesAtual}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            Voltar ao mês atual
          </button>
        )}
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
              const pct = ordensNoPeriodo.length ? (v / ordensNoPeriodo.length) * 100 : 0;
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
            {ordensNoPeriodo.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-display font-bold mb-4 flex items-center gap-2">
            <Users className="size-4" /> Origem dos leads
          </h3>
          <div className="space-y-2">
            {topOrigens.map(([k, v]) => {
              const pct = clientesNoPeriodo.length ? (v / clientesNoPeriodo.length) * 100 : 0;
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
            {topOrigens.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem leads no período.</p>
            )}
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
            {(() => {
              const totalClientes = data?.clientes.length ?? 0;
              const novos = clientesNoPeriodo.length;
              const vips = (data?.clientes ?? []).filter((c) => c.vip).length;
              return (
                <>
                  <Stat
                    icon={Users}
                    label="Novos no período"
                    value={`${novos}/${totalClientes}`}
                  />
                  <Stat
                    icon={Crown}
                    label="VIPs"
                    value={`${vips}/${totalClientes}`}
                  />
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecionar período</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">De</Label>
              <Input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                max={draftTo}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Até</Label>
              <Input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                min={draftFrom}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={resetMesAtual}>
              Mês atual
            </Button>
            <Button type="button" onClick={applyPeriod} disabled={!draftFrom || !draftTo || draftFrom > draftTo}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
