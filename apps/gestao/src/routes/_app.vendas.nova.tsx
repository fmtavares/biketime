import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/vendas/nova")({ component: NovaBike });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CurrencyInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const display = value == null || value === 0 ? "" : brl(value);
  return (
    <Input
      inputMode="numeric"
      placeholder="R$ 0,00"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) return onChange(null);
        onChange(Number(digits) / 100);
      }}
    />
  );
}

function NovaBike() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [genMkt, setGenMkt] = useState(false);
  const [form, setForm] = useState<any>({
    status: "em_estoque",
    data_entrada: new Date().toISOString().slice(0, 10),
    custo_bike: 0, frete: 0, custos_adicionais: 0,
    visivel_ecommerce: false,
  });

  const { data: marcas } = useQuery({
    queryKey: ["marcas_bikes"],
    queryFn: async () => {
      const { data } = await supabase.from("marcas_bikes").select("nome").order("nome");
      return data ?? [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["financial_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("financial_settings").select("*").limit(1).maybeSingle();
      return data as any;
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores podem cadastrar bikes do estoque.</p>;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const icms_pct = form.override_icms_pct ?? settings?.icms_pct ?? 0;
  const markup_pct = form.override_markup_pct ?? settings?.markup_pct ?? 0;
  const custo_bike = Number(form.custo_bike) || 0;
  const frete = Number(form.frete) || 0;
  const custos_adicionais = Number(form.custos_adicionais) || 0;
  const valor_proposto_calc =
    (custo_bike + frete + custos_adicionais + custo_bike * (icms_pct / 100)) *
    (1 + markup_pct / 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.marca || !form.modelo) return toast.error("Marca e modelo obrigatórios");
    setSaving(true);
    const payload = { ...form, valor_proposto: valor_proposto_calc || null };
    const { data, error } = await supabase.from("bikes_estoque").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Bike cadastrada");
    navigate({ to: "/vendas/$id", params: { id: data!.id } });
  }

  async function gerarTextoMarketing() {
    const nome = `${form.marca ?? ""} ${form.modelo ?? ""}`.trim();
    if (!nome) return toast.error("Informe marca e modelo primeiro");
    setGenMkt(true);
    const { data, error } = await supabase.functions.invoke("bike-marketing-text", {
      body: { bikeName: nome },
    });
    setGenMkt(false);
    if (error || data?.error) return toast.error(error?.message || data?.error || "Erro");
    set("observacoes_tecnicas", data?.text ?? "");
    toast.success("Texto gerado");
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-xl sm:text-2xl font-display font-bold">Nova bike</h1>
        <p className="text-sm text-muted-foreground">Cadastre as informações principais. Você pode completar depois.</p>
      </header>

      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="SKU"><Input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Nº de série"><Input value={form.numero_serie ?? ""} onChange={(e) => set("numero_serie", e.target.value)} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set("status", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="em_estoque">Em estoque</option>
              <option value="reservada">Reservada</option>
              <option value="em_montagem">Em montagem</option>
              <option value="em_transito">Em trânsito</option>
              <option value="consignada">Consignada</option>
              <option value="vendida">Vendida</option>
            </select>
          </Field>
          <Field label="Data de entrada"><Input type="date" value={form.data_entrada} onChange={(e) => set("data_entrada", e.target.value)} /></Field>
          <Field label="Fornecedor"><Input value={form.fornecedor ?? ""} onChange={(e) => set("fornecedor", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Técnico</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Marca *">
            <Input required list="marcas-list" value={form.marca ?? ""} onChange={(e) => set("marca", e.target.value)} />
            <datalist id="marcas-list">
              {marcas?.map((m: any) => <option key={m.nome} value={m.nome} />)}
            </datalist>
          </Field>
          <Field label="Modelo *"><Input required value={form.modelo ?? ""} onChange={(e) => set("modelo", e.target.value)} /></Field>
          <Field label="Ano"><Input type="number" value={form.ano ?? ""} onChange={(e) => set("ano", e.target.value ? +e.target.value : null)} /></Field>
          <Field label="Categoria">
            <select value={form.categoria ?? ""} onChange={(e) => set("categoria", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option><option>Road</option><option>MTB</option><option>Gravel</option><option>Triathlon</option><option>Urbana</option>
            </select>
          </Field>
          <Field label="Tamanho"><Input value={form.tamanho ?? ""} onChange={(e) => set("tamanho", e.target.value)} /></Field>
          <Field label="Material do quadro"><Input value={form.material_quadro ?? ""} onChange={(e) => set("material_quadro", e.target.value)} /></Field>
          <Field label="Peso (kg)"><Input type="number" step="0.01" value={form.peso ?? ""} onChange={(e) => set("peso", e.target.value ? +e.target.value : null)} /></Field>
          <Field label="Cor"><Input value={form.cor ?? ""} onChange={(e) => set("cor", e.target.value)} /></Field>
          <Field label="Condição">
            <select value={form.condicao ?? ""} onChange={(e) => set("condicao", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">—</option><option value="nova">Nova</option><option value="seminova">Seminova</option>
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Componentes</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {["grupo","modelo_grupo","relacao","freios","rodas","suspensao","guidao","canote","pedivela","pneus","medidor_potencia","acessorios"].map((k) => (
            <Field key={k} label={k.replace("_", " ")}>
              <Input value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Financeiro — custos base</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {["custo_bike","frete","custos_adicionais"].map((k) => (
            <Field key={k} label={k.replace("_", " ")}>
              <CurrencyInput value={form[k]} onChange={(v) => set(k, v ?? 0)} />
            </Field>
          ))}
          <Field label="Valor de mercado">
            <CurrencyInput value={form.valor_mercado} onChange={(v) => set("valor_mercado", v)} />
          </Field>
          <Field label="Valor proposto (calculado)">
            <Input readOnly value={valor_proposto_calc ? brl(valor_proposto_calc) : ""} placeholder="R$ 0,00" className="bg-muted" />
          </Field>
          <Field label="Valor mínimo aceitável">
            <CurrencyInput value={form.valor_minimo} onChange={(v) => set("valor_minimo", v)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Parâmetros financeiros (override por bike)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            { k: "override_icms_pct", g: "icms_pct", label: "ICMS %" },
            { k: "override_imposto_venda_pct", g: "imposto_venda_pct", label: "Imposto venda %" },
            { k: "override_taxa_financeira_pct", g: "taxa_financeira_pct", label: "Taxa financeira %" },
            { k: "override_comissao_pct", g: "comissao_pct", label: "Comissão %" },
            { k: "override_markup_pct", g: "markup_pct", label: "Markup %" },
          ].map((f) => (
            <Field key={f.k} label={f.label}>
              <Input
                type="number"
                step="0.01"
                placeholder={`Padrão: ${settings?.[f.g] ?? 0}`}
                value={form[f.k] ?? ""}
                onChange={(e) => set(f.k, e.target.value === "" ? null : +e.target.value)}
              />
            </Field>
          ))}
          <p className="md:col-span-3 text-xs text-muted-foreground">Deixe em branco para usar o valor padrão global. Valores preenchidos aplicam-se somente a esta bike.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Texto de Marketing</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={gerarTextoMarketing} disabled={genMkt}>
            {genMkt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Gerar com IA</span>
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea rows={5} value={form.observacoes_tecnicas ?? ""} onChange={(e) => set("observacoes_tecnicas", e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <input
              id="visivel_ecommerce"
              type="checkbox"
              checked={!!form.visivel_ecommerce}
              onChange={(e) => set("visivel_ecommerce", e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Label htmlFor="visivel_ecommerce" className="text-sm">Visibilidade eCommerce</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/vendas/estoque" })}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar bike"}</Button>
      </div>
    </form>
  );
}
