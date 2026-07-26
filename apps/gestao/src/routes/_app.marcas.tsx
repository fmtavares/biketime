import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marcas")({
  component: MarcasPage,
});

const PAGE_SIZE = 20;

/**
 * Cadastro de marcas de bikes (lista usada em formulários da gestão).
 */
function MarcasPage() {
  const { isAdmin } = useAuth();
  const [nova, setNova] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data: marcas = [], refetch, isLoading } = useQuery({
    queryKey: ["marcas-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marcas_bikes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return marcas;
    return marcas.filter((m) => m.nome?.toLowerCase().includes(s));
  }, [marcas, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, pageSafe]);

  /**
   * Atualiza busca e volta para a primeira página.
   */
  function onSearch(v: string) {
    setQ(v);
    setPage(1);
  }

  /**
   * Inclui nova marca na tabela marcas_bikes.
   */
  async function adicionar() {
    if (!isAdmin) return toast.error("Somente administradores");
    const nome = nova.trim();
    if (!nome) return;
    setBusy(true);
    const { error } = await supabase.from("marcas_bikes").insert({ nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Marca adicionada");
    setNova("");
    setPage(1);
    refetch();
  }

  /**
   * Remove marca após confirmação.
   */
  async function remover(id: string) {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!confirm("Remover esta marca?")) return;
    const { error } = await supabase.from("marcas_bikes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marca removida");
    refetch();
  }

  const from = filtered.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const to = Math.min(pageSafe * PAGE_SIZE, filtered.length);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Marcas de bikes"
        description="Marcas disponíveis nos cadastros de bikes e estoque"
      />

      <div className="mb-4">
        <SearchBar
          value={q}
          onChange={onSearch}
          placeholder="Buscar marca…"
        />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Tag className="size-4" />
          <h2 className="font-display font-bold">Marcas</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length}
            {q.trim() ? ` de ${marcas.length}` : ""} cadastradas
          </span>
        </div>

        {isAdmin && (
          <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Nova marca"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
            />
            <Button onClick={adicionar} disabled={busy}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <ul className="divide-y">
              {pageItems.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between px-5 py-2.5 text-sm"
                >
                  <span>{m.nome}</span>
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={() => remover(m.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
              {pageItems.length === 0 && (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma marca encontrada.
                </li>
              )}
            </ul>

            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {from}–{to} de {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pageSafe} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
