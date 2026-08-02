import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/parametros-nfe")({
  component: ParametrosNfePage,
});

/**
 * Parâmetros do prestador para emissão de NFS-e (Focus NFe / Pref. SP).
 * Token da API fica nos secrets do Supabase, não nesta tela.
 */
function ParametrosNfePage() {
  const { isAdmin, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: "",
    cnpj: "",
    inscricao_municipal: "",
    codigo_municipio: "3550308",
    optante_simples_nacional: true,
    natureza_operacao: "1",
    regime_especial_tributacao: "",
    item_lista_servico: "",
    codigo_tributario_municipio: "",
    aliquota: "",
    discriminacao_padrao: "",
    codigo_nbs: "",
    codigo_indicador_operacao: "",
    ibs_cbs_classificacao_tributaria: "",
    consumidor_final: "0",
  });

  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      const { data, error } = await supabase.from("nfse_settings").select("*").limit(1).maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data) return;
      setForm({
        id: data.id,
        cnpj: data.cnpj ?? "",
        inscricao_municipal: data.inscricao_municipal ?? "",
        codigo_municipio: data.codigo_municipio ?? "3550308",
        optante_simples_nacional: !!data.optante_simples_nacional,
        natureza_operacao: data.natureza_operacao ?? "1",
        regime_especial_tributacao: data.regime_especial_tributacao ?? "",
        item_lista_servico: data.item_lista_servico ?? "",
        codigo_tributario_municipio: data.codigo_tributario_municipio ?? "",
        aliquota: data.aliquota != null ? String(data.aliquota) : "",
        discriminacao_padrao: data.discriminacao_padrao ?? "",
        codigo_nbs: data.codigo_nbs ?? "",
        codigo_indicador_operacao: data.codigo_indicador_operacao ?? "",
        ibs_cbs_classificacao_tributaria: data.ibs_cbs_classificacao_tributaria ?? "",
        consumidor_final: String(data.consumidor_final ?? 0),
      });
    })();
  }, [isAdmin]);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  /**
   * Persiste CNPJ, CCM e códigos fiscais (ISS + reforma IBS/CBS) para a Focus.
   */
  async function salvar() {
    if (!form.id) return toast.error("Configuração NFS-e ainda não existe no banco. Rode a migration.");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("nfse_settings")
        .update({
          cnpj: form.cnpj.replace(/\D/g, ""),
          inscricao_municipal: form.inscricao_municipal.replace(/\D/g, ""),
          codigo_municipio: form.codigo_municipio.replace(/\D/g, "") || "3550308",
          optante_simples_nacional: form.optante_simples_nacional,
          natureza_operacao: form.natureza_operacao || "1",
          regime_especial_tributacao: form.regime_especial_tributacao || null,
          item_lista_servico: form.item_lista_servico.trim(),
          codigo_tributario_municipio: form.codigo_tributario_municipio.trim() || null,
          aliquota: form.aliquota === "" ? null : Number(form.aliquota),
          discriminacao_padrao: form.discriminacao_padrao.trim() || null,
          codigo_nbs: form.codigo_nbs.trim() || null,
          codigo_indicador_operacao: form.codigo_indicador_operacao.trim() || null,
          ibs_cbs_classificacao_tributaria: form.ibs_cbs_classificacao_tributaria.trim() || null,
          consumidor_final: Number(form.consumidor_final) || 0,
        })
        .eq("id", form.id);
      if (error) toast.error(error.message);
      else toast.success("Parâmetros NFe salvos");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Parâmetro NFe"
        description="Dados do prestador para emitir NFS-e na OS paga (Focus NFe / Pref. SP)"
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="size-4" />
            <h2 className="font-display font-bold">Prestador (NFS-e)</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Em SP use o código municipal no item (ex.: <code className="text-xs">07498</code>). No{" "}
            <b>Simples Nacional</b> a Pref. exige leiaute 1 (só ISS) — NBS/IBS-CBS são ignorados na emissão.
          </p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              placeholder="somente números"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Inscrição Municipal (CCM)</Label>
            <Input
              value={form.inscricao_municipal}
              onChange={(e) => setForm((f) => ({ ...f, inscricao_municipal: e.target.value }))}
              placeholder="somente números"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Item lista de serviços (código SP)</Label>
            <Input
              value={form.item_lista_servico}
              onChange={(e) => setForm((f) => ({ ...f, item_lista_servico: e.target.value }))}
              placeholder="ex.: 07498"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Alíquota ISS % (ex. 5)</Label>
            <Input
              type="number"
              step="0.0001"
              value={form.aliquota}
              onChange={(e) => setForm((f) => ({ ...f, aliquota: e.target.value }))}
              placeholder="5"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código NBS *</Label>
            <Input
              value={form.codigo_nbs}
              onChange={(e) => setForm((f) => ({ ...f, codigo_nbs: e.target.value }))}
              placeholder="confirme com o contador"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código indicador operação *</Label>
            <Input
              value={form.codigo_indicador_operacao}
              onChange={(e) => setForm((f) => ({ ...f, codigo_indicador_operacao: e.target.value }))}
              placeholder="ex.: 020701"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Classificação IBS/CBS (cClassTrib) *</Label>
            <Input
              value={form.ibs_cbs_classificacao_tributaria}
              onChange={(e) =>
                setForm((f) => ({ ...f, ibs_cbs_classificacao_tributaria: e.target.value }))
              }
              placeholder="ex.: 000001"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Código IBGE município</Label>
            <Input
              value={form.codigo_municipio}
              onChange={(e) => setForm((f) => ({ ...f, codigo_municipio: e.target.value }))}
              placeholder="3550308 = São Paulo"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Texto extra na discriminação (opcional)</Label>
            <Input
              value={form.discriminacao_padrao}
              onChange={(e) => setForm((f) => ({ ...f, discriminacao_padrao: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.optante_simples_nacional}
              onChange={(e) =>
                setForm((f) => ({ ...f, optante_simples_nacional: e.target.checked }))
              }
            />
            Optante do Simples Nacional
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.consumidor_final === "1"}
              onChange={(e) =>
                setForm((f) => ({ ...f, consumidor_final: e.target.checked ? "1" : "0" }))
              }
            />
            Consumidor final
          </label>
        </div>
        <div className="px-5 py-4 border-t flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground max-w-xl">
            Erro de schema v2 / leiaute 1: no painel Focus → Empresas → Documentos fiscais, deixe só
            NFS-e (não “Ambiente da NFSe Nacional”) e abra chamado pedindo{" "}
            <code>nfews.prefeitura.sp.gov.br</code> ou leiaute 1 para Simples.
          </p>
          <Button onClick={() => void salvar()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
