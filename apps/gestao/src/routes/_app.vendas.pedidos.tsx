import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fmtBRL } from "@/lib/finance";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vendas/pedidos")({
  component: PedidosLojaPage,
});

const statusLabel: Record<string, string> = {
  aguardando_loja: "Aguardando a loja",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

/**
 * Lista os pedidos do showroom.
 * Mudar o status não baixa estoque nem altera a bike.
 */
function PedidosLojaPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["pedidos-loja"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*, clientes(nome), parceiros(nome), pedido_itens(id, nome, tamanho, quantidade, preco_unitario)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * Atualiza só o status do pedido. O estoque permanece intacto.
   */
  async function mudarStatus(id: string, status: string) {
    const { error } = await supabase.from("pedidos").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["pedidos-loja"] });
  }

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores.</p>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-display font-bold sm:text-2xl">Pedidos da loja</h1>
        <p className="text-sm text-muted-foreground">
          Pedidos do showroom. Confirmar aqui não tira a peça da vitrine.
        </p>
      </header>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">Nenhum pedido ainda.</p>
      ) : (
        <div className="grid gap-3">
          {data.map((p) => (
            <article key={p.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    #{p.numero} · {(p.clientes as { nome?: string } | null)?.nome ?? "Cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                    {p.codigo_cupom ? ` · Cupom ${p.codigo_cupom}` : ""}
                    {(p.parceiros as { nome?: string } | null)?.nome
                      ? ` · ${(p.parceiros as { nome: string }).nome}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{fmtBRL(Number(p.total) || 0)}</p>
                  {Number(p.desconto) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Desconto {fmtBRL(Number(p.desconto))}
                    </p>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {(p.pedido_itens as { id: string; nome: string; tamanho: string | null; quantidade: number }[] | null)?.map(
                  (i) => (
                    <li key={i.id}>
                      {i.nome}
                      {i.tamanho ? ` · ${i.tamanho}` : ""} × {Number(i.quantidade)}
                    </li>
                  ),
                )}
              </ul>
              <label className="mt-3 block text-xs text-muted-foreground">
                Status
                <select
                  value={p.status}
                  onChange={(e) => mudarStatus(p.id, e.target.value)}
                  className="mt-1 h-9 rounded-md border bg-background px-3 text-sm text-foreground"
                >
                  {Object.entries(statusLabel).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
