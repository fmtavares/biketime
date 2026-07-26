import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/parametros-financeiros")({
  component: ParametrosFinanceirosPage,
});

const FIELDS = [
  { k: "icms_pct", label: "ICMS %" },
  { k: "imposto_venda_pct", label: "Imposto de venda %" },
  { k: "taxa_financeira_pct", label: "Taxa financeira %" },
  { k: "comissao_pct", label: "Comissão vendedor %" },
  { k: "markup_pct", label: "Markup padrão %" },
] as const;

/**
 * Parâmetros financeiros padrão usados no cálculo de vendas.
 */
function ParametrosFinanceirosPage() {
  const { isAdmin, loading } = useAuth();
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["financial-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  /**
   * Persiste os parâmetros no singleton financial_settings.
   */
  async function save() {
    if (!form) return;
    setBusy(true);
    const { id: _id, updated_at: _u, updated_by: _ub, ...rest } = form;
    const { error } = await supabase
      .from("financial_settings")
      .update(rest)
      .eq("id", form.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Parâmetros salvos");
    refetch();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Parâmetros financeiros"
        description="Defaults usados no cálculo de preço e margem das vendas"
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          <h2 className="font-display font-bold">Parâmetros (Vendas)</h2>
        </div>
        {!form ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.k}>
                  <Label>{f.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form[f.k] ?? 0}
                    onChange={(e) =>
                      setForm({ ...form, [f.k]: +e.target.value })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
