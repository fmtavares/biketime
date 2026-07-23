import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { slugifyNome } from "@/lib/produto-categoria";
import { gerarProximoSku } from "@/lib/produto-sku";

const NOVA_CATEGORIA = "__nova_cat__";
const NOVA_MARCA = "__nova_marca__";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Input monetário simples (centavos → número). */
function CurrencyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const display = !value ? "" : brl(value);
  return (
    <Input
      inputMode="numeric"
      placeholder="R$ 0,00"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) / 100 : 0);
      }}
    />
  );
}

type Produto = {
  id?: string;
  nome: string;
  marca_id: string;
  modelo: string;
  categoria_id: string;
  descricao: string;
  preco_venda: number;
  custo: number;
  /** Markup % (UI) — venda = custo × (1 + markup%/100). */
  markup_pct: number;
  sku: string;
  estoque_atual: number;
  fotos: string[];
  ativo: boolean;
  visivel_ecommerce: boolean;
  observacoes: string;
};

const empty: Produto = {
  nome: "",
  marca_id: "",
  modelo: "",
  categoria_id: "",
  descricao: "",
  preco_venda: 0,
  custo: 0,
  markup_pct: 0,
  sku: "",
  estoque_atual: 0,
  fotos: [],
  ativo: true,
  visivel_ecommerce: false,
  observacoes: "",
};

/** Calcula markup % a partir de custo e preço de venda. */
function markupFrom(custo: number, venda: number): number {
  if (!custo || custo <= 0) return 0;
  return Math.round((((venda || 0) / custo) - 1) * 10000) / 100;
}

/** Calcula preço de venda: custo × (1 + markup%/100). */
function vendaFrom(custo: number, markupPct: number): number {
  return Math.round((custo || 0) * (1 + (markupPct || 0) / 100) * 100) / 100;
}

/**
 * Dialog de criar/editar produto para o showroom e estoque de acessórios.
 * Categoria e marca: seleciona existente ou cria nova na hora.
 */
export function ProdutoFormDialog({
  open,
  onOpenChange,
  produto,
  duplicata = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto?: any | null;
  /** Quando true, trata como novo cadastro pré-preenchido (sem id). */
  duplicata?: boolean;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<Produto>(empty);
  const [busy, setBusy] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [catSelect, setCatSelect] = useState("");
  const [marcaSelect, setMarcaSelect] = useState("");
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [novaMarcaNome, setNovaMarcaNome] = useState("");

  const { data: categorias = [] } = useQuery({
    queryKey: ["produto-categorias"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_categorias")
        .select("id, nome, slug, ativo, ordem")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: marcas = [] } = useQuery({
    queryKey: ["produto-marcas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_marcas")
        .select("id, nome, slug, ativo, ordem")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (produto) {
      const catId = produto.categoria_id ?? "";
      const marcaId = produto.marca_id ?? "";
      const custo = Number(produto.custo) || 0;
      const preco_venda = Number(produto.preco_venda) || 0;
      // Duplicata: nunca carrega id (sempre cria novo no save)
      const { id: _ignoreId, ...rest } = produto;
      setForm({
        ...empty,
        ...rest,
        ...(duplicata || !produto.id ? { id: undefined } : { id: produto.id }),
        fotos: produto.fotos ?? [],
        modelo: produto.modelo ?? "",
        descricao: produto.descricao ?? "",
        sku: duplicata ? "" : (produto.sku ?? ""),
        observacoes: produto.observacoes ?? "",
        categoria_id: catId,
        marca_id: marcaId,
        custo,
        preco_venda,
        markup_pct: markupFrom(custo, preco_venda),
      });
      setCatSelect(catId);
      setMarcaSelect(marcaId);
      setNovaCategoriaNome("");
      setNovaMarcaNome("");
    } else {
      setForm(empty);
      setCatSelect("");
      setMarcaSelect("");
      setNovaCategoriaNome("");
      setNovaMarcaNome("");
    }
  }, [open, produto, duplicata]);

  /** Define categoria padrão (Capacete) quando a lista carrega em produto novo. */
  useEffect(() => {
    if (!open || produto || catSelect || categorias.length === 0) return;
    const capacete = categorias.find((c) => c.slug === "capacete") ?? categorias[0];
    setForm((f) => ({ ...f, categoria_id: capacete.id }));
    setCatSelect(capacete.id);
  }, [open, produto, categorias, catSelect]);

  const set = (k: keyof Produto, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const criandoNovaCat = catSelect === NOVA_CATEGORIA;
  const criandoNovaMarca = marcaSelect === NOVA_MARCA;

  /** Abre cropper 4:3 para a foto principal. */
  function onPickFile(file: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setCropOpen(true);
  }

  /** Faz upload da foto recortada e atualiza o formulário. */
  async function uploadCropped(file: File) {
    setBusy(true);
    const id = form.id ?? crypto.randomUUID();
    const path = `${id}/principal-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("loja-produtos")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });
    if (upErr) {
      setBusy(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("loja-produtos").getPublicUrl(path);
    set("fotos", [pub.publicUrl, ...(form.fotos ?? []).filter((u) => u !== pub.publicUrl)]);
    setBusy(false);
    toast.success("Foto adicionada");
  }

  /**
   * Resolve id de lookup: usa existente ou cria na tabela informada.
   * Retorna { id, nome, slug } ou null se inválido.
   */
  async function resolveLookup(opts: {
    criandoNova: boolean;
    novoNome: string;
    atualId: string;
    lista: { id: string; nome: string; slug: string; ordem?: number | null }[];
    tabela: "produto_categorias" | "produto_marcas";
    queryKey: string;
    label: string;
  }): Promise<{ id: string; nome: string; slug: string } | null> {
    const {
      criandoNova,
      novoNome,
      atualId,
      lista,
      tabela,
      queryKey,
      label,
    } = opts;

    if (criandoNova) {
      const nome = novoNome.trim();
      if (!nome) {
        toast.error(`Informe o nome da nova ${label}`);
        return null;
      }
      const slug = slugifyNome(nome);
      if (!slug) {
        toast.error(`Nome de ${label} inválido`);
        return null;
      }

      const existente = lista.find(
        (c) => c.slug === slug || c.nome.toLowerCase() === nome.toLowerCase(),
      );
      if (existente) return { id: existente.id, nome: existente.nome, slug: existente.slug };

      const maxOrdem = lista.reduce((m, c) => Math.max(m, Number(c.ordem) || 0), 0);
      const { data, error } = await supabase
        .from(tabela)
        .insert({ nome, slug, ordem: maxOrdem + 10 })
        .select("id, nome, slug")
        .single();
      if (error) {
        toast.error(error.message);
        return null;
      }
      await qc.invalidateQueries({ queryKey: [queryKey] });
      return data;
    }

    if (!atualId) {
      toast.error(`Selecione uma ${label}`);
      return null;
    }
    const item = lista.find((c) => c.id === atualId);
    return { id: atualId, nome: item?.nome ?? "", slug: item?.slug ?? "" };
  }

  /**
   * Obtém slugs de categoria/marca a partir da seleção atual (sem persistir).
   * Usado pelo botão Gerar SKU.
   */
  function slugsAtuais(): { catSlug: string; marcaSlug: string } | null {
    const catSlug = criandoNovaCat
      ? slugifyNome(novaCategoriaNome)
      : categorias.find((c) => c.id === form.categoria_id)?.slug ?? "";
    const marcaSlug = criandoNovaMarca
      ? slugifyNome(novaMarcaNome)
      : marcas.find((m) => m.id === form.marca_id)?.slug ?? "";
    if (!catSlug || !marcaSlug) return null;
    return { catSlug, marcaSlug };
  }

  /** Gera SKU CAT-MAR-NNN e preenche o campo. */
  async function onGerarSku() {
    const slugs = slugsAtuais();
    if (!slugs) {
      return toast.error("Selecione categoria e marca antes de gerar o SKU");
    }
    setBusy(true);
    try {
      const sku = await gerarProximoSku(slugs.catSlug, slugs.marcaSlug);
      set("sku", sku);
      toast.success(`SKU gerado: ${sku}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível gerar o SKU");
    } finally {
      setBusy(false);
    }
  }

  const save = async () => {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setBusy(true);

    const cat = await resolveLookup({
      criandoNova: criandoNovaCat,
      novoNome: novaCategoriaNome,
      atualId: form.categoria_id,
      lista: categorias,
      tabela: "produto_categorias",
      queryKey: "produto-categorias",
      label: "categoria",
    });
    if (!cat) {
      setBusy(false);
      return;
    }

    const marca = await resolveLookup({
      criandoNova: criandoNovaMarca,
      novoNome: novaMarcaNome,
      atualId: form.marca_id,
      lista: marcas,
      tabela: "produto_marcas",
      queryKey: "produto-marcas",
      label: "marca",
    });
    if (!marca) {
      setBusy(false);
      return;
    }

    let sku = form.sku.trim();
    if (!sku) {
      if (!cat.slug || !marca.slug) {
        setBusy(false);
        return toast.error("Não foi possível gerar o SKU (categoria/marca sem slug)");
      }
      try {
        sku = await gerarProximoSku(cat.slug, marca.slug);
      } catch (e: any) {
        setBusy(false);
        return toast.error(e?.message ?? "Não foi possível gerar o SKU");
      }
    }

    const base = {
      nome: form.nome.trim(),
      marca_id: marca.id,
      marca: marca.nome || null,
      modelo: form.modelo || null,
      categoria_id: cat.id,
      categoria: cat.nome || null,
      descricao: form.descricao || null,
      preco_venda: Number(form.preco_venda) || 0,
      custo: Number(form.custo) || 0,
      sku,
      estoque_atual: Number(form.estoque_atual) || 0,
      fotos: form.fotos ?? [],
      ativo: !!form.ativo,
      visivel_ecommerce: !!form.visivel_ecommerce,
      observacoes: form.observacoes || null,
    };

    const { error } = form.id
      ? await supabase.from("produtos").update(base).eq("id", form.id)
      : await supabase
          .from("produtos")
          .insert({ ...base, created_by: user?.id ?? null });

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Produto atualizado" : "Produto criado");
    onSaved?.();
    onOpenChange(false);
  };

  const foto = form.fotos?.[0] ?? null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? "Editar produto"
                : duplicata
                  ? "Novo produto (cópia)"
                  : "Novo produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <select
                value={catSelect}
                onChange={(e) => {
                  const v = e.target.value;
                  setCatSelect(v);
                  if (v === NOVA_CATEGORIA) {
                    set("categoria_id", "");
                  } else {
                    set("categoria_id", v);
                    setNovaCategoriaNome("");
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
                <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
              </select>
              {criandoNovaCat && (
                <Input
                  className="mt-2"
                  placeholder="Ex.: Luvas, Caramanhola…"
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <div className="flex gap-2">
                <Input
                  value={form.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="Auto: CAP-GIR-001"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={busy}
                  onClick={() => void onGerarSku()}
                >
                  Gerar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vazio no save → gera automático (categoria + marca + sequência)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Marca</Label>
              <select
                value={marcaSelect}
                onChange={(e) => {
                  const v = e.target.value;
                  setMarcaSelect(v);
                  if (v === NOVA_MARCA) {
                    set("marca_id", "");
                  } else {
                    set("marca_id", v);
                    setNovaMarcaNome("");
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
                <option value={NOVA_MARCA}>+ Nova marca…</option>
              </select>
              {criandoNovaMarca && (
                <Input
                  className="mt-2"
                  placeholder="Ex.: Giro, Oakley…"
                  value={novaMarcaNome}
                  onChange={(e) => setNovaMarcaNome(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Custo</Label>
              <CurrencyInput
                value={form.custo}
                onChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    custo: v,
                    preco_venda: vendaFrom(v, f.markup_pct),
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Markup %</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder="Ex.: 100"
                value={form.markup_pct || ""}
                onChange={(e) => {
                  const markup_pct = e.target.value === "" ? 0 : Number(e.target.value) || 0;
                  setForm((f) => ({
                    ...f,
                    markup_pct,
                    preco_venda: vendaFrom(f.custo, markup_pct),
                  }));
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Venda = custo × (1 + markup%/100)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço de venda</Label>
              <CurrencyInput
                value={form.preco_venda}
                onChange={(v) => {
                  setForm((f) => ({
                    ...f,
                    preco_venda: v,
                    markup_pct: markupFrom(f.custo, v),
                  }));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estoque</Label>
              <Input
                type="number"
                value={form.estoque_atual}
                onChange={(e) => set("estoque_atual", Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => set("descricao", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs">Foto principal</Label>
              <div className="relative aspect-[4/3] max-w-xs overflow-hidden rounded-md border bg-secondary/30">
                {foto ? (
                  <img src={foto} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sem foto
                  </div>
                )}
              </div>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPickFile(f);
                    e.target.value = "";
                  }}
                />
                <span className="inline-flex h-8 cursor-pointer items-center rounded-md border bg-background px-3 text-xs hover:bg-secondary">
                  {busy ? "Enviando…" : foto ? "Trocar foto" : "Enviar foto"}
                </span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.visivel_ecommerce}
                onCheckedChange={(v) => set("visivel_ecommerce", v)}
                id="prod-ecom"
              />
              <Label htmlFor="prod-ecom">Visível no showroom (/loja)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => set("ativo", v)}
                id="prod-ativo"
              />
              <Label htmlFor="prod-ativo">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageCropDialog
        open={cropOpen}
        imageSrc={cropSrc}
        title="Ajustar foto do produto"
        aspect={4 / 3}
        onOpenChange={(o) => {
          setCropOpen(o);
          if (!o && cropSrc) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onConfirm={(file) => {
          void uploadCropped(file);
        }}
      />
    </>
  );
}
