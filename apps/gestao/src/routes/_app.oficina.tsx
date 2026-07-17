import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, User, Wrench, LogIn } from "lucide-react";
import { OSFormDialog } from "@/components/OSFormDialog";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";

export const Route = createFileRoute("/_app/oficina")({
  component: OficinaPage,
});

const GRUPOS = [
  {
    titulo: "Recepção",
    colunas: [
      { id: "fila", label: "Fila de Entrada" },
      { id: "avaliacao", label: "Avaliação" },
      { id: "aguardando_aprovacao", label: "Aguardando aprovação" },
    ],
  },
  {
    titulo: "Execução",
    colunas: [
      { id: "em_execucao", label: "Em execução" },
      { id: "com_problemas", label: "Com problemas" },
      { id: "finalizada", label: "Finalizada" },
    ],
  },
  {
    titulo: "Entrega & Pagamento",
    colunas: [
      { id: "entregue", label: "Entregue" },
      { id: "pago", label: "Pago" },
    ],
  },
];
const COLUNAS = GRUPOS.flatMap((g) => g.colunas);
const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão"];

function OficinaPage() {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const { data, refetch } = useQuery({
    queryKey: ["os-kanban"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome), bikes(marca, modelo)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    COLUNAS.forEach((c) => (g[c.id] = []));
    (data ?? []).forEach((o) => {
      (g[o.status] ?? g.fila).push(o);
    });
    return g;
  }, [data]);

  const moveTo = async (osId: string, status: string) => {
    const os = (data ?? []).find((o) => o.id === osId);
    let extra: Record<string, any> = {};
    if (status === "avaliacao" && os && !os.responsavel_avaliacao) {
      const { data: auth } = await supabase.auth.getUser();
      let nome = auth.user?.email ?? "";
      if (auth.user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle();
        nome = prof?.full_name ?? prof?.email ?? nome;
      }
      extra.responsavel_avaliacao = nome;
      extra.data_avaliacao = new Date().toISOString();
    }
    if (status === "em_execucao" && os && !os.aprovado_por) {
      const { data: auth } = await supabase.auth.getUser();
      let nome = auth.user?.email ?? "";
      if (auth.user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle();
        nome = prof?.full_name ?? prof?.email ?? nome;
      }
      extra.aprovado_por = nome;
      extra.aprovado = true;
    }
    if (status === "pago" && os && (!os.pago_por || !os.forma_pagamento)) {
      const recebedor = window.prompt("Quem do Bike Time recebeu o pagamento?");
      if (!recebedor?.trim()) {
        toast.error("Informe quem recebeu o pagamento");
        return;
      }
      const formaMsg = "Forma de pagamento:\n\n" +
        FORMAS_PAGAMENTO.map((f, i) => `${i + 1} - ${f}`).join("\n") +
        "\n\nDigite o número:";
      const fchoice = window.prompt(formaMsg);
      const fidx = Number(fchoice) - 1;
      if (!fchoice || isNaN(fidx) || fidx < 0 || fidx >= FORMAS_PAGAMENTO.length) {
        toast.error("Forma de pagamento obrigatória");
        return;
      }
      extra.pago_por = recebedor.trim();
      extra.forma_pagamento = FORMAS_PAGAMENTO[fidx];
      extra.data_pagamento = new Date().toISOString();
    }
    const statusAprovado = ["em_execucao", "com_problemas", "finalizada", "entregue", "pago"].includes(status);
    if (statusAprovado) {
      extra.data_aprovacao = os?.data_aprovacao || new Date().toISOString();
    }
    const statusFinalizado = ["finalizada", "entregue", "pago"].includes(status);
    const statusEntregue = ["entregue", "pago"].includes(status);
    extra.data_conclusao = statusFinalizado
      ? (os?.data_conclusao || new Date().toISOString())
      : null;
    extra.data_entrega = statusEntregue
      ? (os?.data_entrega || new Date().toISOString())
      : null;
    if (statusFinalizado && os && !os.responsavel_execucao) {
      const { data: auth } = await supabase.auth.getUser();
      let nome = auth.user?.email ?? "";
      if (auth.user?.id) {
        const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle();
        nome = prof?.full_name ?? prof?.email ?? nome;
      }
      extra.responsavel_execucao = nome;
    }
    const { error } = await supabase.from("ordens_servico").update({ status, ...extra }).eq("id", osId);
    if (error) return toast.error(error.message);
    refetch();
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over?.id ? String(e.over.id) : null;
    if (id && target) moveTo(id, target);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Oficina"
        description="Fluxo Kanban das ordens de serviço"
        action={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="size-4" /> Nova OS</Button>}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo}>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                {grupo.titulo}
              </h2>
              <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto pb-2">
                <div
                  className="grid gap-3 min-w-max sm:min-w-0"
                  style={{ gridTemplateColumns: `repeat(${grupo.colunas.length}, minmax(220px, 1fr))` }}
                >
                  {grupo.colunas.map((col) => {
                    const isPago = col.id === "pago";
                    const items = isPago
                      ? (grouped[col.id]?.slice(0, 5) ?? [])
                      : (grouped[col.id] ?? []);
                    return (
                      <DroppableColumn key={col.id} id={col.id} label={col.label} count={items.length}>
                        {items.map((o) => (
                          <DraggableCard
                            key={o.id}
                            os={o}
                            onClick={() => { setEdit(o); setOpen(true); }}
                          />
                        ))}
                      </DroppableColumn>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      <OSFormDialog open={open} onOpenChange={setOpen} os={edit} onSaved={() => refetch()} />
    </div>
  );
}

function DroppableColumn({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-0 rounded-xl bg-secondary/40 border p-3 flex flex-col transition-colors ${isOver ? "bg-primary/10 border-primary" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm truncate">{label}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-background border shrink-0 ml-2">{count}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">{children}</div>
    </div>
  );
}

function DraggableCard({ os: o, onClick }: { os: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: o.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    touchAction: "none",
  };
  // Formata YYYY-MM-DD sem deslocamento de timezone
  const fmtDateOnly = (s?: string | null) => {
    if (!s) return "";
    const [y, m, d] = s.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  };
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const atrasada = o.data_prevista && o.data_prevista < hojeStr &&
    !["finalizada", "entregue", "pago"].includes(o.status);

  if (o.status === "pago") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={onClick}
        className="rounded-lg bg-card border px-2 py-1.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow flex items-center gap-2"
      >
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-foreground text-background shrink-0">{o.numero}</span>
        <span className="text-xs font-medium truncate flex-1">{o.clientes?.nome}</span>
        {o.data_pagamento && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {new Date(o.data_pagamento).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`rounded-lg bg-card border p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${atrasada ? "border-destructive/40" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-foreground text-background">{o.numero}</span>
        <div className="flex items-center gap-1.5">
          {o.data_prevista && (
            <span className={`text-[10px] ${atrasada ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {fmtDateOnly(o.data_prevista)}
            </span>
          )}
          {atrasada && <AlertTriangle className="size-3.5 text-destructive" />}
        </div>
      </div>
      <div className="mt-2 text-sm font-medium truncate">{o.clientes?.nome}</div>
      <div className="text-xs text-muted-foreground truncate">{o.bikes?.marca} {o.bikes?.modelo}</div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        {o.mecanico && <span className="inline-flex items-center gap-1"><LogIn className="size-3" />{o.mecanico}</span>}
        {o.data_entrada && (
          <span>{new Date(o.data_entrada).toLocaleDateString("pt-BR")}</span>
        )}
      </div>
      {o.quem_puxou ? (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-300 text-yellow-950 border border-yellow-500">
          <Wrench className="size-3" /> {o.quem_puxou}
        </div>
      ) : (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-200 text-red-950 border border-red-400">
          <Wrench className="size-3" /> ... aguardando
        </div>
      )}
    </div>
  );
}
