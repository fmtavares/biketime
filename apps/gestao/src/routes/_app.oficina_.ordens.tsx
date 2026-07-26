import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { OSFormDialog } from "@/components/OSFormDialog";

export const Route = createFileRoute("/_app/oficina_/ordens")({
  component: OrdensServicoPage,
});

const STATUS_LABEL: Record<string, string> = {
  fila: "Fila",
  avaliacao: "Avaliação",
  aguardando_aprovacao: "Aguardando aprovação",
  em_execucao: "Em execução",
  com_problemas: "Com problemas",
  finalizada: "Finalizada",
  entregue: "Entregue",
  pago: "Pago",
};

/**
 * Lista de ordens de serviço (visão tabular, aparte do Painel kanban).
 */
function OrdensServicoPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["os-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome), bikes(marca, modelo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return data;
    return data.filter((o: any) => {
      const bike = `${o.bikes?.marca ?? ""} ${o.bikes?.modelo ?? ""}`;
      return `${o.numero ?? ""} ${o.clientes?.nome ?? ""} ${bike} ${o.status ?? ""}`
        .toLowerCase()
        .includes(s);
    });
  }, [data, q]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Ordens de Serviço"
        description={`${data.length} ordens`}
        action={
          <Button
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova OS
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Buscar número, cliente, bike…"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {filtered.map((o: any) => (
              <button
                key={o.id}
                type="button"
                className="rounded-xl border bg-card p-4 text-left hover:shadow-md transition-shadow"
                onClick={() => {
                  setEdit(o);
                  setOpen(true);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">
                    {o.numero ?? "OS"}
                    <span className="text-muted-foreground font-normal">
                      {" · "}
                      {o.clientes?.nome ?? "—"}
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {[o.bikes?.marca, o.bikes?.modelo].filter(Boolean).join(" ") || "—"}
                  {o.data_entrada
                    ? ` · ${new Date(o.data_entrada).toLocaleDateString("pt-BR")}`
                    : ""}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl">
                Nenhuma OS encontrada.
              </div>
            )}
          </div>

          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">OS</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Bike</th>
                  <th className="text-left px-4 py-3">Entrada</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o: any) => (
                  <tr
                    key={o.id}
                    className="border-t hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setEdit(o);
                      setOpen(true);
                    }}
                  >
                    <td className="px-4 py-3 font-medium">{o.numero ?? "—"}</td>
                    <td className="px-4 py-3">
                      {o.cliente_id ? (
                        <Link
                          to="/clientes/$id"
                          params={{ id: o.cliente_id }}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.clientes?.nome ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[o.bikes?.marca, o.bikes?.modelo].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.data_entrada
                        ? new Date(o.data_entrada).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {STATUS_LABEL[o.status] ?? o.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Nenhuma OS encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <OSFormDialog
        open={open}
        onOpenChange={setOpen}
        os={edit}
        onSaved={() => refetch()}
      />
    </div>
  );
}
