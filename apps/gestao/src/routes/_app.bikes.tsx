import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus, Bike as BikeIcon } from "lucide-react";
import { BikeFormDialog } from "@/components/BikeFormDialog";

export const Route = createFileRoute("/_app/bikes")({
  component: BikesPage,
});

function BikesPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["bikes-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bikes")
        .select("*, clientes(id, nome), bike_fotos(storage_path)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  /** Filtra bikes por marca, modelo, código do adesivo, série ou cliente. */
  const filtered = (data ?? []).filter((b: any) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      b.marca?.toLowerCase().includes(s) ||
      b.modelo?.toLowerCase().includes(s) ||
      b.codigo_bike?.toLowerCase().includes(s) ||
      b.numero_serie?.toLowerCase().includes(s) ||
      b.clientes?.nome?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Bikes"
        description={`${data?.length ?? 0} bicicletas`}
        action={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> Nova bike</Button>}
      />

      <div className="mb-4 max-w-md">
        <SearchBar value={q} onChange={setQ} placeholder="Marca, modelo, código, série, cliente…" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filtered.map((b: any) => {
          const foto = b.bike_fotos?.[0]?.storage_path;
          const url = foto ? supabase.storage.from("bike-fotos").getPublicUrl(foto).data.publicUrl : null;
          return (
            <Link key={b.id} to="/bikes/$id" params={{ id: b.id }}
              className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
              <div className="aspect-[4/3] bg-secondary flex items-center justify-center">
                {url ? <img src={url} alt={b.modelo} className="w-full h-full object-cover" /> : <BikeIcon className="size-12 text-muted-foreground" />}
              </div>
              <div className="p-4">
                <div className="font-display font-bold">{b.marca} {b.modelo}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.clientes?.nome}</div>
                <div className="text-xs text-muted-foreground">{b.ano} · {b.tamanho ?? "—"}</div>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground border rounded-xl">
            Nenhuma bike cadastrada.
          </div>
        )}
      </div>

      <BikeFormDialog open={open} onOpenChange={setOpen} onSaved={() => refetch()} />
    </div>
  );
}
