import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tipos-atividade")({
  component: TiposAtividadePage,
});

/**
 * Cadastro de tipos de atividade usados em Pendências.
 */
function TiposAtividadePage() {
  const { isAdmin, loading } = useAuth();
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tipos = [], refetch, isLoading } = useQuery({
    queryKey: ["tipo-atividade"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("tipo_atividade")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  /**
   * Inclui novo tipo de atividade.
   */
  async function adicionar() {
    const nome = novo.trim();
    if (!nome) return;
    setBusy(true);
    const { error } = await (supabase.from as any)("tipo_atividade").insert({ nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Tipo adicionado");
    setNovo("");
    refetch();
  }

  /**
   * Remove tipo de atividade após confirmação.
   */
  async function remover(id: string) {
    if (!confirm("Remover este tipo de atividade?")) return;
    const { error } = await (supabase.from as any)("tipo_atividade").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tipo removido");
    refetch();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Tipos de atividade"
        description="Usados no cadastro de pendências"
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <ListChecks className="size-4" />
          <h2 className="font-display font-bold">Tipos</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {tipos.length} cadastrados
          </span>
        </div>
        <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Novo tipo de atividade"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
          />
          <Button onClick={adicionar} disabled={busy}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <ul className="divide-y">
            {tipos.map((t: any) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-5 py-2.5 text-sm"
              >
                <span>{t.nome}</span>
                <Button size="sm" variant="ghost" onClick={() => remover(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
            {tipos.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                Nenhum tipo cadastrado.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
