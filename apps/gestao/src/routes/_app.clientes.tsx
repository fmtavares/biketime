import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Crown, Phone } from "lucide-react";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*, bikes(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.nome?.toLowerCase().includes(s) ||
      c.whatsapp?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Clientes"
        description={`${data?.length ?? 0} cadastrados`}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Novo cliente
          </Button>
        }
      />

      <div className="mb-4 max-w-md min-w-0">
        <SearchBar value={q} onChange={setQ} placeholder="Buscar por nome, WhatsApp, email…" />
      </div>

      {/* Mobile cards — min-w-0 evita invadir a borda direita com texto longo */}
      <div className="grid min-w-0 gap-3 lg:hidden">
        {filtered.map((c) => (
          <Link
            key={c.id}
            to="/clientes/$id"
            params={{ id: c.id }}
            className="block min-w-0 max-w-full overflow-hidden rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="font-medium flex items-center gap-2 min-w-0">
                {c.vip && <Crown className="size-3.5 text-accent fill-accent shrink-0" />}
                <span className="truncate">{c.nome}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {(c as any).bikes?.length ?? 0} bikes
              </span>
            </div>
            <div className="mt-1 min-w-0 space-y-0.5 text-xs text-muted-foreground">
              {c.whatsapp && (
                <div className="flex min-w-0 items-center gap-1">
                  <Phone className="size-3 shrink-0" />
                  <span className="truncate">{c.whatsapp}</span>
                </div>
              )}
              {(c.cidade || c.estado) && (
                <div className="truncate">
                  {c.cidade}
                  {c.estado ? `, ${c.estado}` : ""}
                </div>
              )}
              {c.origem_lead && (
                <div className="truncate">Origem: {c.origem_lead}</div>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-xl">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Cliente</th>
              <th className="text-left px-4 py-3">Contato</th>
              <th className="text-left px-4 py-3">Cidade</th>
              <th className="text-left px-4 py-3">Bikes</th>
              <th className="text-left px-4 py-3">Origem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-t hover:bg-secondary/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/clientes/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:underline flex items-center gap-2"
                  >
                    {c.vip && <Crown className="size-3.5 text-accent fill-accent" />}
                    {c.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.whatsapp && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" /> {c.whatsapp}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.cidade}
                  {c.estado ? `, ${c.estado}` : ""}
                </td>
                <td className="px-4 py-3">{(c as any).bikes?.length ?? 0}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.origem_lead}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClienteFormDialog open={open} onOpenChange={setOpen} onSaved={() => refetch()} />
    </div>
  );
}
