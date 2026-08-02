import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Scan interno da gestão: /b/BTB-00001 → ficha da bike.
 * O QR impresso aponta para o site; a equipe usa esta rota após login na gestão
 * (ou via redirect staff a partir do site).
 */
export const Route = createFileRoute("/_app/b/$codigo")({
  loader: async ({ params }) => {
    const codigo = decodeURIComponent(params.codigo).trim().toUpperCase();
    const { data, error } = await supabase
      .from("bikes")
      .select("id")
      .eq("codigo_bike", codigo)
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) {
      return { notFound: true as const, codigo };
    }

    throw redirect({
      to: "/bikes/$id",
      params: { id: data.id },
    });
  },
  component: BikeScanGestaoPage,
});

/**
 * Fallback quando o código não existe (equipe logada).
 */
function BikeScanGestaoPage() {
  const { notFound, codigo } = Route.useLoaderData();

  if (!notFound) return null;

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="font-display text-xl font-bold">Código não encontrado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Nenhuma bike com o código <span className="font-mono font-semibold">{codigo}</span>.
      </p>
      <Link to="/bikes" className="mt-6 inline-block text-sm underline underline-offset-2">
        Ir para bikes
      </Link>
    </div>
  );
}
