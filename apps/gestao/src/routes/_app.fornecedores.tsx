import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Truck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FornecedorFormDialog } from "@/components/FornecedorFormDialog";
import { formatCnpj, formatPhoneBr } from "@/lib/utils";

export const Route = createFileRoute("/_app/fornecedores")({
  component: FornecedoresPage,
});

/**
 * Lista e gerencia fornecedores da loja (padrão visual de Clientes/Bikes).
 */
function FornecedoresPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return fornecedores;
    return fornecedores.filter((f: any) =>
      `${f.nome} ${f.nome_fantasia ?? ""} ${f.cnpj ?? ""} ${f.contato ?? ""} ${f.cidade ?? ""} ${f.estado ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [fornecedores, q]);

  /**
   * Exclui fornecedor após confirmação e atualiza a lista.
   */
  async function remove(id: string) {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["fornecedores-list"] });
  }

  /**
   * Abre o dialog em modo edição.
   */
  function abrirEdicao(f: any) {
    setEdit(f);
    setOpen(true);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Fornecedores"
        description={`${fornecedores.length} cadastrados`}
        action={
          isAdmin ? (
            <Button
              onClick={() => {
                setEdit(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Novo fornecedor
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 max-w-md">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Buscar nome, CNPJ, cidade…"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-3 lg:hidden">
            {filtered.map((f: any) => (
              <div key={f.id} className="rounded-xl border bg-card p-4">
                <Link
                  to="/fornecedores/$id"
                  params={{ id: f.id }}
                  className="block min-w-0"
                >
                  <div className="font-medium flex flex-wrap items-center gap-2">
                    <span className="truncate hover:underline">{f.nome}</span>
                    {f.ativo ? (
                      <Badge variant="secondary">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </div>
                  {f.nome_fantasia && (
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {f.nome_fantasia}
                    </div>
                  )}
                  <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {f.cnpj && <div className="whitespace-nowrap">{formatCnpj(f.cnpj)}</div>}
                    {f.telefone && (
                      <div className="whitespace-nowrap">{formatPhoneBr(f.telefone)}</div>
                    )}
                    {(f.cidade || f.estado) && (
                      <div>{[f.cidade, f.estado].filter(Boolean).join("/")}</div>
                    )}
                  </div>
                </Link>
                {isAdmin && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => abrirEdicao(f)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(f.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border rounded-xl">
                <Truck className="size-8 mx-auto mb-2 opacity-50" />
                Nenhum fornecedor encontrado.
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-left px-4 py-3">CNPJ</th>
                  <th className="text-left px-4 py-3">Telefone</th>
                  <th className="text-left px-4 py-3">Cidade</th>
                  <th className="text-left px-4 py-3">Status</th>
                  {isAdmin && <th className="text-right px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((f: any) => (
                  <tr
                    key={f.id}
                    className="border-t hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to="/fornecedores/$id"
                        params={{ id: f.id }}
                        className="font-medium hover:underline"
                      >
                        {f.nome}
                      </Link>
                      {f.nome_fantasia && (
                        <div className="text-sm text-muted-foreground">
                          {f.nome_fantasia}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
                      {f.cnpj ? formatCnpj(f.cnpj) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
                      {f.telefone ? formatPhoneBr(f.telefone) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
                      {[f.cidade, f.estado].filter(Boolean).join("/") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {f.ativo ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Inativo</Badge>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => abrirEdicao(f)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(f.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="text-center py-12 text-muted-foreground"
                    >
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FornecedorFormDialog
        open={open}
        onOpenChange={setOpen}
        fornecedor={edit}
        onSaved={() => qc.invalidateQueries({ queryKey: ["fornecedores-list"] })}
      />
    </div>
  );
}
