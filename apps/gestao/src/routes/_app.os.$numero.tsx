import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OSFormDialog } from "@/components/OSFormDialog";
import { Loader2 } from "lucide-react";

/**
 * Scan interno da gestão: /os/OS-123 → abre o formulário da OS.
 * Usado pelo botão "Ler QR" após decodificar a etiqueta.
 */
export const Route = createFileRoute("/_app/os/$numero")({
  loader: async ({ params }) => {
    const numero = decodeURIComponent(params.numero).trim().toUpperCase();
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("*, clientes(nome), bikes(marca, modelo, codigo_bike)")
      .eq("numero", numero)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return { notFound: true as const, numero, os: null };
    }
    return { notFound: false as const, numero, os: data };
  },
  component: OsScanGestaoPage,
});

/**
 * Abre a OS encontrada; se não achar, mostra fallback.
 */
function OsScanGestaoPage() {
  const { notFound, numero, os } = Route.useLoaderData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!notFound && os) setOpen(true);
  }, [notFound, os]);

  /** Fecha o formulário e volta ao painel da oficina. */
  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      void navigate({ to: "/oficina" });
    }
  }

  if (notFound || !os) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="font-display text-xl font-bold">OS não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nenhuma ordem com o número{" "}
          <span className="font-mono font-semibold">{numero}</span>.
        </p>
        <Link
          to="/oficina/ordens"
          className="mt-6 inline-block text-sm underline underline-offset-2"
        >
          Ir para ordens
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <OSFormDialog
        open={open}
        onOpenChange={handleOpenChange}
        os={os}
        onSaved={() => {
          /* mantém aberto após salvar; usuário fecha quando quiser */
        }}
      />
    </div>
  );
}
