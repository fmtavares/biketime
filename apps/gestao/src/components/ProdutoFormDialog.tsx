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
  /** Grade de tamanho; vazio = produto único sem variantes. */
  grade_id: string;
  descricao: string;
  preco_venda: number;
  custo: number;
  /** Valor de referência de mercado (não altera markup/venda). */
  valor_mercado: number;
  /** Markup % (UI) — valor proposto = custo × (1 + markup%/100). */
  markup_pct: number;
  sku: string;
  estoque_atual: number;
  fotos: string[];
  ativo: boolean;
  visivel_ecommerce: boolean;
  observacoes: string;
};

/** Linha editável de variante (tamanho + estoque) no formulário. */
type VarianteForm = {
  id?: string;
  tamanho: string;
  estoque: number;
  ativo: boolean;
};

const empty: Produto = {
  nome: "",
  marca_id: "",
  modelo: "",
  categoria_id: "",
  grade_id: "",
  descricao: "",
  preco_venda: 0,
  custo: 0,
  valor_mercado: 0,
  markup_pct: 0,
  sku: "",
  estoque_atual: 0,
  fotos: [],
  ativo: true,
  visivel_ecommerce: false,
  observacoes: "",
};

/** Calcula markup % a partir de custo e valor proposto. */
function markupFrom(custo: number, venda: number): number {
  if (!custo || custo <= 0) return 0;
  return Math.round((((venda || 0) / custo) - 1) * 10000) / 100;
}

/** Calcula valor proposto: custo × (1 + markup%/100). */
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
  const [variantes, setVariantes] = useState<VarianteForm[]>([]);
  /** Snapshot do banco para remountar a matriz quando a grade carregar. */
  const [variantesDb, setVariantesDb] = useState<VarianteForm[]>([]);

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
        .order("nome");
      if (error) throw error;
      // A–Z; "Outra" fica no final para não misturar com marcas reais
      const lista = data ?? [];
      return [...lista].sort((a, b) => {
        const aOutra = a.slug === "outra" || a.nome.toLowerCase() === "outra";
        const bOutra = b.slug === "outra" || b.nome.toLowerCase() === "outra";
        if (aOutra !== bOutra) return aOutra ? 1 : -1;
        return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
      });
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["tamanho-grades"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tamanho_grades")
        .select("id, slug, nome, ordem, tamanho_grade_itens(valor, ordem)")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  /**
   * Monta linhas de variantes a partir da grade, preservando estoque/id já existentes.
   */
  function montarVariantesDaGrade(
    gradeId: string,
    existentes: VarianteForm[] = [],
  ): VarianteForm[] {
    const grade = grades.find((g: any) => g.id === gradeId);
    const itens = [...(grade?.tamanho_grade_itens ?? [])].sort(
      (a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0),
    );
    return itens.map((item: any) => {
      const prev = existentes.find((v) => v.tamanho === item.valor);
      return {
        id: prev?.id,
        tamanho: item.valor as string,
        estoque: prev?.estoque ?? 0,
        ativo: prev?.ativo ?? true,
      };
    });
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function carregar() {
      if (produto) {
        const catId = produto.categoria_id ?? "";
        const marcaId = produto.marca_id ?? "";
        const gradeId = produto.grade_id ?? "";
        const custo = Number(produto.custo) || 0;
        const preco_venda = Number(produto.preco_venda) || 0;
        const valor_mercado = Number(produto.valor_mercado) || 0;
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
          grade_id: gradeId,
          estoque_atual: duplicata ? 0 : Number(produto.estoque_atual) || 0,
          custo,
          preco_venda,
          valor_mercado,
          markup_pct: markupFrom(custo, preco_venda),
        });
        setCatSelect(catId);
        setMarcaSelect(marcaId);
        setNovaCategoriaNome("");
        setNovaMarcaNome("");

        if (produto.id && !duplicata) {
          const { data: vars } = await supabase
            .from("produto_variantes")
            .select("id, tamanho, estoque, ativo")
            .eq("produto_id", produto.id);
          if (cancelled) return;
          const existentes: VarianteForm[] = (vars ?? []).map((v: any) => ({
            id: v.id,
            tamanho: v.tamanho,
            estoque: Number(v.estoque) || 0,
            ativo: !!v.ativo,
          }));
          setVariantesDb(existentes);
          if (gradeId) {
            setVariantes(montarVariantesDaGrade(gradeId, existentes));
          } else {
            setVariantes([]);
          }
        } else if (gradeId) {
          setVariantesDb([]);
          setVariantes(montarVariantesDaGrade(gradeId, []));
        } else {
          setVariantesDb([]);
          setVariantes([]);
        }
      } else {
        setForm(empty);
        setCatSelect("");
        setMarcaSelect("");
        setNovaCategoriaNome("");
        setNovaMarcaNome("");
        setVariantesDb([]);
        setVariantes([]);
      }
    }

    void carregar();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, produto, duplicata]);

  /**
   * Quando as grades terminam de carregar e a matriz ainda está vazia/incompleta,
   * remonta a partir do snapshot do banco (evita race no open do dialog).
   */
  useEffect(() => {
    if (!open || !form.grade_id || grades.length === 0) return;
    const grade = grades.find((g: any) => g.id === form.grade_id);
    const expected = grade?.tamanho_grade_itens?.length ?? 0;
    if (!expected) return;
    setVariantes((prev) => {
      if (prev.length === expected) return prev;
      const base = prev.length ? prev : variantesDb;
      return montarVariantesDaGrade(form.grade_id, base);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades, open, form.grade_id, variantesDb]);

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

  /**
   * Persiste o produto (create/update), incluindo valor de mercado de referência.
   */
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

    const gradeId = form.grade_id || null;
    const temGrade = !!gradeId;

    const base = {
      nome: form.nome.trim(),
      marca_id: marca.id,
      marca: marca.nome || null,
      modelo: form.modelo || null,
      categoria_id: cat.id,
      categoria: cat.nome || null,
      grade_id: gradeId,
      descricao: form.descricao || null,
      preco_venda: Number(form.preco_venda) || 0,
      custo: Number(form.custo) || 0,
      valor_mercado: Number(form.valor_mercado) || null,
      sku,
      // Com grade o trigger recalcula; sem grade usa o campo manual
      estoque_atual: temGrade
        ? variantes.filter((v) => v.ativo).reduce((s, v) => s + (Number(v.estoque) || 0), 0)
        : Number(form.estoque_atual) || 0,
      fotos: form.fotos ?? [],
      ativo: !!form.ativo,
      visivel_ecommerce: !!form.visivel_ecommerce,
      observacoes: form.observacoes || null,
    };

    let produtoId = form.id ?? null;

    if (form.id) {
      const { error } = await supabase.from("produtos").update(base).eq("id", form.id);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("produtos")
        .insert({ ...base, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
      produtoId = data.id;
    }

    if (produtoId) {
      const syncErr = await syncVariantes(produtoId, temGrade, variantes);
      if (syncErr) {
        setBusy(false);
        return toast.error(syncErr);
      }
    }

    setBusy(false);
    toast.success(form.id ? "Produto atualizado" : "Produto criado");
    onSaved?.();
    onOpenChange(false);
  };

  /**
   * Persiste variantes do produto: upsert por tamanho; desativa as que saíram da grade.
   */
  async function syncVariantes(
    produtoId: string,
    temGrade: boolean,
    rows: VarianteForm[],
  ): Promise<string | null> {
    const { data: existentes, error: listErr } = await supabase
      .from("produto_variantes")
      .select("id, tamanho")
      .eq("produto_id", produtoId);
    if (listErr) return listErr.message;

    if (!temGrade) {
      if ((existentes ?? []).length > 0) {
        const { error } = await supabase
          .from("produto_variantes")
          .update({ ativo: false })
          .eq("produto_id", produtoId);
        if (error) return error.message;
      }
      return null;
    }

    const porTamanho = new Map((existentes ?? []).map((v: any) => [v.tamanho, v.id as string]));
    const tamanhosAtivos = new Set(rows.map((r) => r.tamanho));

    for (const row of rows) {
      const payload = {
        produto_id: produtoId,
        tamanho: row.tamanho,
        estoque: Number(row.estoque) || 0,
        ativo: !!row.ativo,
      };
      const existingId = porTamanho.get(row.tamanho);
      if (existingId) {
        const { error } = await supabase
          .from("produto_variantes")
          .update(payload)
          .eq("id", existingId);
        if (error) return error.message;
      } else {
        const { error } = await supabase.from("produto_variantes").insert(payload);
        if (error) return error.message;
      }
    }

    const paraDesativar = (existentes ?? [])
      .filter((v: any) => !tamanhosAtivos.has(v.tamanho))
      .map((v: any) => v.id as string);
    if (paraDesativar.length > 0) {
      const { error } = await supabase
        .from("produto_variantes")
        .update({ ativo: false })
        .in("id", paraDesativar);
      if (error) return error.message;
    }

    return null;
  }

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
                Valor proposto = custo × (1 + markup%/100)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor de mercado</Label>
              <CurrencyInput
                value={form.valor_mercado}
                onChange={(v) => set("valor_mercado", v)}
              />
              <p className="text-[11px] text-muted-foreground">
                Referência de mercado (não altera o valor proposto)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor proposto</Label>
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
              <Label className="text-xs">Grade de tamanho</Label>
              <select
                value={form.grade_id}
                onChange={(e) => {
                  const grade_id = e.target.value;
                  setForm((f) => ({ ...f, grade_id }));
                  if (!grade_id) {
                    setVariantes([]);
                  } else {
                    setVariantes((prev) => montarVariantesDaGrade(grade_id, prev));
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Nenhuma (item único)</option>
                {grades.map((g: any) => (
                  <option key={g.id} value={g.id}>
                    {g.nome}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Roupa, sapatilha etc. — ou deixe vazio se o item não tem tamanho
              </p>
            </div>
            {!form.grade_id ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Estoque</Label>
                <Input
                  type="number"
                  value={form.estoque_atual}
                  onChange={(e) => set("estoque_atual", Number(e.target.value) || 0)}
                />
              </div>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Estoque por tamanho</Label>
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Tamanho</th>
                        <th className="px-3 py-2 font-medium">Estoque</th>
                        <th className="px-3 py-2 font-medium">Ativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantes.map((v, idx) => (
                        <tr key={v.tamanho} className="border-t">
                          <td className="px-3 py-2 font-medium">{v.tamanho}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-24"
                              value={v.estoque}
                              onChange={(e) => {
                                const estoque = Number(e.target.value) || 0;
                                setVariantes((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, estoque } : r)),
                                );
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Switch
                              checked={v.ativo}
                              onCheckedChange={(ativo) => {
                                setVariantes((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, ativo } : r)),
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Total:{" "}
                  {variantes
                    .filter((v) => v.ativo)
                    .reduce((s, v) => s + (Number(v.estoque) || 0), 0)}{" "}
                  un.
                </p>
              </div>
            )}
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
