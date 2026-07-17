import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Bike, Wrench, Crown, AlertTriangle, Calendar, DollarSign, Cake } from "lucide-react";


export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        accent ? "bg-accent text-accent-foreground border-transparent" : "bg-card"
      }`}
      style={accent ? { boxShadow: "var(--shadow-yellow)" } : { boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="size-4 opacity-70" />
      </div>
      <div className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-display font-bold">{value}</div>
    </div>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [bikes, os, clientes, osList, aniv] = await Promise.all([
        supabase.from("bikes").select("id", { count: "exact", head: true }),
        supabase
          .from("ordens_servico")
          .select("id, numero, status, data_prevista, proxima_revisao, valor_aprovado, valor_pecas, valor_mao_obra, clientes(nome), bikes(marca, modelo)")
          .order("created_at", { ascending: false }),
        supabase.from("clientes").select("id, nome, vip").eq("vip", true),
        supabase.from("ordens_servico").select("status"),
        supabase.from("clientes").select("id, nome, data_nascimento").not("data_nascimento", "is", null),
      ]);
      return { bikes, os, clientes, osList, aniv };
    },
  });

  const ordens = data?.os.data ?? [];
  const emOficina = ordens.filter((o) =>
    ["fila", "avaliacao", "aguardando_aprovacao", "em_execucao", "com_problemas"].includes(o.status),
  );
  const atrasadas = emOficina.filter(
    (o) => o.data_prevista && new Date(o.data_prevista) < new Date(),
  );
  const faturamento = ordens
    .filter((o) => o.status === "entregue" || o.status === "finalizada")
    .reduce((sum, o) => sum + Number(o.valor_aprovado ?? (Number(o.valor_pecas ?? 0) + Number(o.valor_mao_obra ?? 0))), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" description="Visão geral da sua operação" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat icon={Wrench} label="Bikes em oficina" value={emOficina.length} accent />
        <Stat icon={AlertTriangle} label="OS atrasadas" value={atrasadas.length} />
        <Stat icon={Crown} label="Clientes VIP" value={data?.clientes.data?.length ?? 0} />
        <Stat icon={Bike} label="Bikes cadastradas" value={data?.bikes.count ?? 0} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div
          className="rounded-xl border p-5 bg-foreground text-background"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider opacity-70">
              A Receber
            </span>
            <DollarSign className="size-4 opacity-70" />
          </div>
          <div className="mt-3 text-3xl font-display font-bold">
            R$ {faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Últimas OS</h3>
            <Link to="/oficina" className="text-xs text-muted-foreground hover:text-foreground">
              Ver Kanban →
            </Link>
          </div>
          <div className="space-y-2">
            {ordens.slice(0, 6).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between text-sm py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2 py-1 rounded bg-secondary">
                    {o.numero}
                  </span>
                  <span>{(o as any).clientes?.nome}</span>
                  <span className="text-muted-foreground">
                    {(o as any).bikes?.marca} {(o as any).bikes?.modelo}
                  </span>
                </div>
                <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-accent/40">
                  {o.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
            {ordens.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma OS ainda. Crie a primeira na aba Oficina.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cake className="size-4" />
          <h3 className="font-display font-bold">Aniversariantes do mês</h3>
          <span className="text-xs text-muted-foreground ml-auto capitalize">
            {new Date().toLocaleDateString("pt-BR", { month: "long" })}
          </span>
        </div>
        <div className="space-y-2 text-sm">
          {(() => {
            const hoje = new Date();
            const mes = hoje.getMonth();
            const diaHoje = hoje.getDate();
            const lista = (data?.aniv.data ?? [])
              .map((c: any) => {
                const [, m, d] = String(c.data_nascimento).split("-").map(Number);
                return { ...c, _mes: m - 1, _dia: d };
              })
              .filter((c: any) => c._mes === mes)
              .sort((a: any, b: any) => a._dia - b._dia);
            if (lista.length === 0) {
              return <p className="text-muted-foreground">Nenhum aniversariante este mês.</p>;
            }
            return lista.map((c: any) => {
              const isHoje = c._dia === diaHoje;
              return (
                <Link
                  key={c.id}
                  to="/clientes/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-secondary/40 -mx-2 px-2 rounded"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-secondary">
                      {String(c._dia).padStart(2, "0")}/{String(c._mes + 1).padStart(2, "0")}
                    </span>
                    <span>{c.nome}</span>
                  </div>
                  {isHoje && (
                    <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-accent text-accent-foreground">
                      Hoje 🎉
                    </span>
                  )}
                </Link>
              );
            });
          })()}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="size-4" />
          <h3 className="font-display font-bold">Próximas revisões recomendadas</h3>
          <span className="text-xs text-muted-foreground ml-auto">Próximas 2 semanas</span>
        </div>
        <div className="space-y-2 text-sm">
          {(() => {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const limite = new Date(hoje);
            limite.setDate(limite.getDate() + 14);
            const proximas = ordens
              .filter((o: any) => {
                if (!o.proxima_revisao) return false;
                const d = new Date(o.proxima_revisao);
                return d >= hoje && d <= limite;
              })
              .sort((a: any, b: any) => new Date(a.proxima_revisao).getTime() - new Date(b.proxima_revisao).getTime());
            if (proximas.length === 0) {
              return <p className="text-muted-foreground">Sem revisões agendadas para os próximos 14 dias.</p>;
            }
            return proximas.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2 py-1 rounded bg-secondary">{o.numero}</span>
                  <span>{o.clientes?.nome}</span>
                  <span className="text-muted-foreground">{o.bikes?.marca} {o.bikes?.modelo}</span>
                </div>
                <span className="text-xs uppercase tracking-wider px-2 py-1 rounded bg-accent/40">
                  {new Date(o.proxima_revisao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
