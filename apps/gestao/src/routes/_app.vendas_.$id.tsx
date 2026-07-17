import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calcBike, fmtBRL, fmtPct, type FinancialSettings } from "@/lib/finance";
import { toast } from "sonner";
import { Trash2, Send, ArrowLeft, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/vendas_/$id")({ component: BikeEstoqueDetail });

const statusLabel: Record<string, string> = {
  em_estoque: "Em estoque", reservada: "Reservada", vendida: "Vendida",
  em_montagem: "Em montagem", em_transito: "Em trânsito", consignada: "Consignada",
};

function BikeEstoqueDetail() {
  const { id } = Route.useParams();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bike-estoque", id],
    queryFn: async () => {
      const [{ data: bike }, { data: settings }, { data: obsRaw }] = await Promise.all([
        supabase.from("bikes_estoque").select("*").eq("id", id).single(),
        supabase.from("financial_settings").select("*").limit(1).maybeSingle(),
        supabase.from("bike_estoque_observations").select("*").eq("bike_estoque_id", id).order("created_at", { ascending: true }),
      ]);
      const obs = obsRaw ?? [];
      const userIds = Array.from(new Set(obs.map((o: any) => o.user_id)));
      let profilesMap: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        profilesMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      const obsWithNames = obs.map((o: any) => ({ ...o, autor: profilesMap[o.user_id] ?? "Usuário" }));
      return { bike, settings: settings as unknown as FinancialSettings, obs: obsWithNames };
    },
  });

  const [edit, setEdit] = useState<any>(null);
  useEffect(() => { if (data?.bike) setEdit(data.bike); }, [data?.bike]);

  const [overrideVenda, setOverrideVenda] = useState<number | "">("");
  const [desconto, setDesconto] = useState<number | "">("");
  const [overrideTaxa, setOverrideTaxa] = useState<number | "">("");
  const [overrideIcms, setOverrideIcms] = useState<number | "">("");
  const [overrideImposto, setOverrideImposto] = useState<number | "">("");
  const [overrideComissao, setOverrideComissao] = useState<number | "">("");
  const [obsTexto, setObsTexto] = useState("");
  const [genDesc, setGenDesc] = useState(false);

  async function gerarDescricaoIA() {
    const nome = `${edit?.marca ?? ""} ${edit?.modelo ?? ""}`.trim();
    if (!nome) return toast.error("Informe marca e modelo primeiro");
    setGenDesc(true);
    const { data, error } = await supabase.functions.invoke("bike-marketing-text", {
      body: { bikeName: nome },
    });
    setGenDesc(false);
    if (error || (data as any)?.error) return toast.error(error?.message || (data as any)?.error || "Erro");
    setEdit((s: any) => ({ ...s, observacoes_tecnicas: (data as any)?.text ?? "" }));
    toast.success("Texto de marketing gerado");
  }

  const baseCalc = useMemo(() => data?.bike ? calcBike({ ...(data.bike as any), settings: data.settings }) : null, [data]);
  const simCalc = useMemo(() => data?.bike ? calcBike({
    ...(data.bike as any), settings: data.settings,
    override_venda: overrideVenda === "" ? undefined : Number(overrideVenda),
    override_taxa_financeira_pct: overrideTaxa === "" ? undefined : Number(overrideTaxa),
    override_icms_pct: overrideIcms === "" ? undefined : Number(overrideIcms),
    override_imposto_venda_pct: overrideImposto === "" ? undefined : Number(overrideImposto),
    override_comissao_pct: overrideComissao === "" ? undefined : Number(overrideComissao),
    desconto: desconto === "" ? 0 : Number(desconto),
  }) : null, [data, overrideVenda, overrideTaxa, desconto, overrideIcms, overrideImposto, overrideComissao]);

  if (isLoading || !data || !data.bike || !edit || !baseCalc || !simCalc) return <p className="text-muted-foreground">Carregando…</p>;
  const b: any = data.bike;

  const dias = Math.floor((Date.now() - new Date(b.data_entrada).getTime()) / 86400000);

  async function saveEdits() {
    const { id: _id, created_at, updated_at, created_by, ...rest } = edit;
    const { error } = await supabase.from("bikes_estoque").update(rest).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["bike-estoque", id] });
  }
  async function deleteBike() {
    if (!confirm("Excluir esta bike?")) return;
    const { error } = await supabase.from("bikes_estoque").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída"); navigate({ to: "/vendas/estoque" });
  }
  async function postObs() {
    const texto = obsTexto.trim();
    if (!texto) return;
    const { error } = await supabase.from("bike_estoque_observations")
      .insert({ bike_estoque_id: id, user_id: user!.id, texto });
    if (error) return toast.error(error.message);
    setObsTexto("");
    qc.invalidateQueries({ queryKey: ["bike-estoque", id] });
  }

  const RECALC_FIELDS = ["custo_bike", "frete", "custos_adicionais", "override_icms_pct", "override_markup_pct"];
  const setEdf = (k: string, v: any) => setEdit((s: any) => {
    const next = { ...s, [k]: v };
    if (RECALC_FIELDS.includes(k)) {
      const icms_pct = next.override_icms_pct ?? (data?.settings as any)?.icms_pct ?? 0;
      const markup_pct = next.override_markup_pct ?? (data?.settings as any)?.markup_pct ?? 0;
      const cb = Number(next.custo_bike) || 0;
      const fr = Number(next.frete) || 0;
      const ca = Number(next.custos_adicionais) || 0;
      const proposto = (cb + fr + ca + cb * (icms_pct / 100)) * (1 + markup_pct / 100);
      next.valor_proposto = proposto || null;
    }
    return next;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <Link to="/vendas/estoque" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Estoque
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold">{b.marca} {b.modelo}</h1>
            <Badge variant="secondary">{statusLabel[b.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {b.sku && <>SKU {b.sku} · </>}{b.tamanho && <>Tam {b.tamanho} · </>}{b.ano} · {dias} dias em estoque
          </p>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={deleteBike}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Custo total</div><div className="mt-1 text-xl font-bold">{fmtBRL(baseCalc.custo_total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Preço sugerido</div><div className="mt-1 text-xl font-bold">{fmtBRL(Number(b.valor_proposto) || 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Lucro estimado</div><div className="mt-1 text-xl font-bold">{fmtBRL(baseCalc.lucro)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Margem</div><div className={`mt-1 text-xl font-bold ${baseCalc.margem_pct < 10 ? "text-destructive" : ""}`}>{fmtPct(baseCalc.margem_pct)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="simulador">
        <TabsList>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="historico">Histórico interno</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="simulador" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Simulador de venda</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div><Label>Valor de venda</Label>
                  <CurrencyInput placeholder={baseCalc.venda} value={overrideVenda} onChange={setOverrideVenda} />
                </div>
                <div><Label>Desconto</Label>
                  <CurrencyInput value={desconto} onChange={setDesconto} />
                </div>
                <div><Label>Taxa financeira %</Label>
                  <Input type="number" placeholder={String(b.override_taxa_financeira_pct ?? data.settings.taxa_financeira_pct)} value={overrideTaxa} onChange={(e) => setOverrideTaxa(e.target.value === "" ? "" : +e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">ICMS %</Label>
                    <Input type="number" placeholder={String(b.override_icms_pct ?? data.settings.icms_pct)} value={overrideIcms} onChange={(e) => setOverrideIcms(e.target.value === "" ? "" : +e.target.value)} />
                  </div>
                  <div><Label className="text-xs">Imposto %</Label>
                    <Input type="number" placeholder={String(b.override_imposto_venda_pct ?? data.settings.imposto_venda_pct)} value={overrideImposto} onChange={(e) => setOverrideImposto(e.target.value === "" ? "" : +e.target.value)} />
                  </div>
                  <div><Label className="text-xs">Comissão %</Label>
                    <Input type="number" placeholder={String(b.override_comissao_pct ?? data.settings.comissao_pct)} value={overrideComissao} onChange={(e) => setOverrideComissao(e.target.value === "" ? "" : +e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 text-xs">
                  <Button type="button" size="sm" variant="outline" onClick={() => setOverrideTaxa(0)}>PIX (0%)</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setOverrideTaxa(data.settings.taxa_financeira_pct)}>Cartão</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setOverrideTaxa(data.settings.taxa_financeira_pct + 3)}>Parcelado</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setOverrideIcms(""); setOverrideImposto(""); setOverrideComissao(""); setOverrideTaxa(""); }}>Resetar %</Button>
                </div>
              </div>
              <div className="space-y-2 rounded-lg bg-secondary/40 p-4 text-sm">
                <Row label="Venda final" value={fmtBRL(simCalc.venda)} bold />
                <Row label="Base de custo" value={fmtBRL(simCalc.base)} />
                <Row label="Taxa financeira" value={fmtBRL(simCalc.taxa_financeira)} />
                <Row label="Imposto venda" value={fmtBRL(simCalc.imposto)} />
                <Row label="Comissão" value={fmtBRL(simCalc.comissao)} />
                <hr className="my-2" />
                <Row label="Lucro" value={fmtBRL(simCalc.lucro)} bold tone={simCalc.lucro < 0 ? "neg" : undefined} />
                <Row label="Margem" value={fmtPct(simCalc.margem_pct)} bold tone={simCalc.margem_pct < 10 ? "neg" : undefined} />
                {b.valor_minimo != null && simCalc.venda < (b.valor_minimo as number) && (
                  <p className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">⚠ Abaixo do valor mínimo aceitável ({fmtBRL(b.valor_minimo as number)}).</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico comercial interno</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {data.obs.length === 0 && <p className="text-sm text-muted-foreground">Sem observações ainda.</p>}
                {data.obs.map((o: any) => (
                  <div key={o.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{o.autor}</span>
                      <span>{new Date(o.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{o.texto}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea value={obsTexto} onChange={(e) => setObsTexto(e.target.value)} placeholder="Escreva uma observação…" rows={2} />
                <Button onClick={postObs} className="self-end"><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-4 space-y-4">
          {!isAdmin && <p className="text-sm text-muted-foreground">Somente administradores podem editar.</p>}
          <Card>
            <CardHeader><CardTitle className="text-base">Fotos</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                { k: "foto_completa", label: "Bike completa" },
                { k: "foto_cambio_frente", label: "Câmbio frente" },
                { k: "foto_cambio_traseiro", label: "Câmbio traseiro" },
                { k: "foto_freio", label: "Freio" },
                { k: "foto_numero_serie", label: "Número de série" },
              ].map(({ k, label }) => (
                <PhotoSlot
                  key={k}
                  label={label}
                  url={edit[k] ?? null}
                  bikeId={id}
                  field={k}
                  isAdmin={isAdmin}
                  onChange={(url) => { setEdf(k, url); }}
                />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Custos</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                {["custo_bike","frete","custos_adicionais","valor_mercado","valor_proposto","valor_minimo"].map((k) => (
                  <div key={k}>
                    <Label className="text-xs uppercase">{k.replace("_"," ")}</Label>
                    <CurrencyInput
                      disabled={!isAdmin}
                      value={edit[k] == null ? "" : Number(edit[k])}
                      onChange={(v) => setEdf(k, v === "" ? null : v)}
                    />
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Parâmetros financeiros (override por bike)</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { k: "icms_pct", label: "ICMS %" },
                    { k: "imposto_venda_pct", label: "Imposto venda %" },
                    { k: "taxa_financeira_pct", label: "Taxa financeira %" },
                    { k: "comissao_pct", label: "Comissão %" },
                    { k: "markup_pct", label: "Markup %" },
                  ].map((f) => {
                    const ok = `override_${f.k}`;
                    const globalVal = (data.settings as any)?.[f.k] ?? 0;
                    return (
                      <div key={f.k}>
                        <Label className="text-xs uppercase">{f.label}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          disabled={!isAdmin}
                          placeholder={`Padrão: ${globalVal}`}
                          value={edit[ok] ?? ""}
                          onChange={(e) => setEdf(ok, e.target.value === "" ? null : +e.target.value)}
                        />
                      </div>
                    );
                  })}
                  {(() => {
                    const s: any = data.settings || {};
                    const icms_pct = edit.override_icms_pct ?? s.icms_pct ?? 0;
                    const imposto_pct = edit.override_imposto_venda_pct ?? s.imposto_venda_pct ?? 0;
                    const taxa_fin_pct = edit.override_taxa_financeira_pct ?? s.taxa_financeira_pct ?? 0;
                    const comissao_pct = edit.override_comissao_pct ?? s.comissao_pct ?? 0;
                    const cb = Number(edit.custo_bike) || 0;
                    const fr = Number(edit.frete) || 0;
                    const ca = Number(edit.custos_adicionais) || 0;
                    const vp = Number(edit.valor_proposto) || 0;
                    const custosBike = cb + fr + ca + cb * (icms_pct / 100);
                    const custosFin = vp * (imposto_pct / 100) + vp * (taxa_fin_pct / 100) + vp * (comissao_pct / 100);
                    const lucro = vp - custosBike - custosFin;
                    const margem = vp > 0 ? (lucro / vp) * 100 : 0;
                    return (
                      <div>
                        <Label className="text-xs uppercase">Lucro</Label>
                        <div className="flex h-9 items-center justify-between rounded-md border bg-secondary/40 px-3">
                          <span className={`text-sm font-semibold ${lucro < 0 ? "text-destructive" : ""}`}>{fmtBRL(lucro)}</span>
                          <span className={`text-xs ${margem < 10 ? "text-destructive" : "text-muted-foreground"}`}>{fmtPct(margem)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Deixe em branco para usar o valor padrão global. Valores preenchidos aplicam-se somente a esta bike.</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Geral</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div><Label className="text-xs uppercase">Status</Label>
                <select value={edit.status} disabled={!isAdmin} onChange={(e) => setEdf("status", e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  {Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {["marca","modelo","tamanho","categoria","ano","cor","material_quadro","fornecedor","grupo","modelo_grupo","relacao","freios","rodas","suspensao"].map((k) => (
                <div key={k}><Label className="text-xs uppercase">{k.replace("_"," ")}</Label>
                  <Input disabled={!isAdmin} value={edit[k] ?? ""} onChange={(e) => setEdf(k, e.target.value)} />
                </div>
              ))}
              <div><Label className="text-xs uppercase">Condição</Label>
                <select disabled={!isAdmin} value={edit.condicao ?? ""} onChange={(e) => setEdf("condicao", e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">—</option>
                  <option value="nova">Nova</option>
                  <option value="seminova">Seminova</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase">Texto de Marketing</Label>
                  {isAdmin && (
                    <Button type="button" size="sm" variant="outline" onClick={gerarDescricaoIA} disabled={genDesc}>
                      {genDesc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">Gerar com IA</span>
                    </Button>
                  )}
                </div>
                <Textarea
                  rows={4}
                  disabled={!isAdmin}
                  value={edit.observacoes_tecnicas ?? ""}
                  onChange={(e) => setEdf("observacoes_tecnicas", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 md:col-span-3 pt-2">
                <input
                  id="visivel_ecommerce"
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={!!edit.visivel_ecommerce}
                  onChange={(e) => setEdf("visivel_ecommerce", e.target.checked)}
                  className="size-4 rounded border-input accent-primary"
                />
                <Label htmlFor="visivel_ecommerce" className="text-sm">Visibilidade eCommerce</Label>
              </div>
            </CardContent>
          </Card>
          {isAdmin && <div className="flex justify-end"><Button onClick={saveEdits}>Salvar alterações</Button></div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CurrencyInput({ value, onChange, placeholder, disabled }: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string>(value === "" ? "" : formatBRLInput(value));
  useEffect(() => {
    setText(value === "" ? "" : formatBRLInput(value));
  }, [value]);
  return (
    <Input
      disabled={disabled}
      inputMode="decimal"
      placeholder={placeholder != null ? `R$ ${formatBRLInput(placeholder)}` : "R$ 0,00"}
      value={text === "" ? "" : `R$ ${text}`}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) { setText(""); onChange(""); return; }
        const n = Number(digits) / 100;
        setText(formatBRLInput(n));
        onChange(n);
      }}
    />
  );
}
function formatBRLInput(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "neg" }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${tone === "neg" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}

function PhotoSlot({ label, url, bikeId, field, isAdmin, onChange }: {
  label: string; url: string | null; bikeId: string; field: string; isAdmin: boolean;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${bikeId}/${field}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("bikes-estoque-photos").upload(path, file, { upsert: true });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("bikes-estoque-photos").getPublicUrl(path);
    const newUrl = pub.publicUrl;
    const { error: dbErr } = await supabase.from("bikes_estoque").update({ [field]: newUrl } as any).eq("id", bikeId);
    setBusy(false);
    if (dbErr) return toast.error(dbErr.message);
    onChange(newUrl);
    toast.success("Foto enviada");
  }

  async function handleRemove() {
    if (!confirm("Remover foto?")) return;
    setBusy(true);
    const { error } = await supabase.from("bikes_estoque").update({ [field]: null } as any).eq("id", bikeId);
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase">{label}</Label>
      <div className="relative aspect-square overflow-hidden rounded-md border bg-secondary/30">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Sem foto</div>
        )}
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <label className="flex-1">
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <span className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-md border bg-background px-2 text-xs hover:bg-secondary">
              {busy ? "Enviando…" : url ? "Trocar" : "Enviar"}
            </span>
          </label>
          {url && (
            <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={busy}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
