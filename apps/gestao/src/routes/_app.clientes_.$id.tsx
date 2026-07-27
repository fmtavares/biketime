import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bike as BikeIcon,
  Crown,
  Edit,
  Plus,
  Mail,
  Phone,
  Instagram,
  MapPin,
  Wrench,
  Trash2,
} from "lucide-react";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";
import { BikeFormDialog } from "@/components/BikeFormDialog";
import { OSFormDialog } from "@/components/OSFormDialog";
import { useAuth } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clientes_/$id")({
  component: ClienteDetail,
});

function ClienteDetail() {
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [bikeOpen, setBikeOpen] = useState(false);
  const [osOpen, setOsOpen] = useState(false);
  /** OS selecionada para edição; null = nova OS. */
  const [osEdit, setOsEdit] = useState<any>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const { data: cliente, refetch } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: bikes, refetch: refetchBikes } = useQuery({
    queryKey: ["cliente-bikes", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bikes")
        .select("*, bike_fotos(storage_path)")
        .eq("cliente_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: oss, refetch: refetchOss } = useQuery({
    queryKey: ["cliente-oss", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ordens_servico")
        .select("*, bikes(marca, modelo)")
        .eq("cliente_id", id)
        .order("data_entrada", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  /** Abre o formulário de nova OS (sem registro carregado). */
  function abrirNovaOs() {
    setOsEdit(null);
    setOsOpen(true);
  }

  /** Abre os detalhes originais de uma OS do histórico. */
  function abrirOs(o: any) {
    setOsEdit(o);
    setOsOpen(true);
  }

  if (!cliente) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <Link to="/clientes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              {cliente.vip && <Crown className="size-5 text-accent fill-accent" />}
              {cliente.nome}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {cliente.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{cliente.whatsapp}</span>}
              {cliente.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" />{cliente.email}</span>}
              {cliente.instagram && <span className="inline-flex items-center gap-1"><Instagram className="size-3.5" />{cliente.instagram}</span>}
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
            <Button onClick={abrirNovaOs} disabled={!(bikes && bikes.length > 0)} title={bikes && bikes.length > 0 ? "Abrir nova OS para este cliente" : "Cadastre uma bike antes de abrir a OS"}>
              <Wrench className="size-4" /> Nova OS
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="size-4" /> Editar
            </Button>
            {isAdmin && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" /> Excluir
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-6 text-sm">
          <Info label="Origem do lead" value={cliente.origem_lead} />
          <Info label="Vendedor" value={cliente.vendedor_responsavel} />
          <Info label="CPF" value={cliente.cpf} />
          <Info label="Modalidades" value={(cliente.modalidades ?? []).join(", ") || "—"} />
          <Info label="Nível" value={cliente.nivel} />
          <Info label="Frequência" value={cliente.frequencia} />
          <Info label="Objetivo" value={cliente.objetivo} />
          <Info label="Equipe" value={cliente.equipe} />
          <Info label="Sonho de consumo" value={cliente.sonho_consumo} />
        </div>

        {cliente.observacoes && (
          <div className="mt-4 p-3 rounded-lg bg-secondary text-sm">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Observações</div>
            {cliente.observacoes}
          </div>
        )}
      </div>

      {(oss?.length ?? 0) > 0 && (
        <div className="mt-6">
          <h2 className="font-display font-bold text-lg mb-3">Últimas Ordens de Serviço</h2>
          <div className="grid gap-2">
            {oss!.map((o: any) => {
              const aberta = !["finalizada", "entregue", "pago"].includes(o.status);
              const atrasada = aberta && o.data_prevista && new Date(o.data_prevista) < new Date();
              const labelStatus: Record<string, string> = {
                fila: "Fila", avaliacao: "Avaliação", aguardando_aprovacao: "Aguardando aprovação",
                em_execucao: "Em execução", com_problemas: "Com problemas",
                finalizada: "Finalizada", entregue: "Entregue", pago: "Pago",
              };
              return (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => abrirOs(o)}
                  className={`rounded-xl border p-4 flex items-center gap-4 flex-wrap w-full text-left transition-colors hover:bg-accent/5 ${
                    aberta ? "bg-accent/10 border-accent/40 ring-1 ring-accent/30" : "bg-card"
                  }`}
                >
                  <span className="font-mono text-xs px-2 py-1 rounded bg-foreground text-background">{o.numero}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {o.bikes?.marca} {o.bikes?.modelo}
                      <span className="text-muted-foreground font-normal"> — {o.problema_relatado || "sem descrição"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Entrada {new Date(o.data_entrada).toLocaleDateString("pt-BR")}
                      {o.data_prevista && (
                        <> · Prevista <span className={atrasada ? "text-destructive font-medium" : ""}>
                          {new Date(o.data_prevista).toLocaleDateString("pt-BR")}
                        </span></>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded font-semibold ${
                    aberta ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    {aberta && "● "}{labelStatus[o.status] ?? o.status}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">Bikes ({bikes?.length ?? 0})</h2>
        <Button onClick={() => setBikeOpen(true)}>
          <Plus className="size-4" /> Nova bike
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-3">
        {bikes?.map((b) => {
          const foto = (b as any).bike_fotos?.[0]?.storage_path;
          const fotoUrl = foto
            ? supabase.storage.from("bike-fotos").getPublicUrl(foto).data.publicUrl
            : null;
          return (
            <Link
              key={b.id}
              to="/bikes/$id"
              params={{ id: b.id }}
              className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] bg-secondary flex items-center justify-center">
                {fotoUrl ? (
                  <img src={fotoUrl} alt={b.modelo} className="w-full h-full object-cover" />
                ) : (
                  <BikeIcon className="size-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-4">
                <div className="font-display font-bold">{b.marca} {b.modelo}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {b.ano} · {b.tamanho ?? "—"} · {b.cor ?? "—"}
                </div>
                <span className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${b.status === "atual" ? "bg-accent text-accent-foreground" : "bg-secondary"}`}>
                  {b.status}
                </span>
              </div>
            </Link>
          );
        })}
        {(bikes?.length ?? 0) === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border rounded-xl">
            Nenhuma bike cadastrada.
          </div>
        )}
      </div>

      <ClienteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cliente={cliente}
        onSaved={() => refetch()}
      />
      <BikeFormDialog
        open={bikeOpen}
        onOpenChange={setBikeOpen}
        clienteId={id}
        onSaved={() => refetchBikes()}
      />
      <OSFormDialog
        open={osOpen}
        onOpenChange={(v) => {
          setOsOpen(v);
          if (!v) setOsEdit(null);
        }}
        os={osEdit}
        defaultClienteId={id}
        onSaved={() => refetchOss()}
        onDeleted={() => {
          setOsEdit(null);
          refetchOss();
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente <strong>{cliente.nome}</strong> será removido permanentemente.
              Bikes e ordens de serviço vinculadas podem impedir a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                const { error } = await supabase.from("clientes").delete().eq("id", id);
                setDeleting(false);
                if (error) {
                  toast.error("Erro ao excluir: " + error.message);
                  return;
                }
                toast.success("Cliente excluído");
                setDeleteOpen(false);
                navigate({ to: "/clientes" });
              }}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}
