import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { slugifyNome } from "@/lib/produto-categoria";

const NOVA = "__nova__";

type Props = {
  value: string;
  onChange: (nome: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Select de categoria de bike: lista dinâmica + opção de criar nova na hora.
 * Persiste o nome em bikes_estoque.categoria (texto).
 */
export function CategoriaBikeSelect({ value, onChange, disabled, className }: Props) {
  const qc = useQueryClient();
  const [selectValue, setSelectValue] = useState("");
  const [novaNome, setNovaNome] = useState("");
  const [busy, setBusy] = useState(false);

  const mostrandoNova = selectValue === NOVA;

  const { data: categorias = [] } = useQuery({
    queryKey: ["bike-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bike_categorias")
        .select("id, nome, slug, ordem")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (mostrandoNova) return;
    if (!value) {
      setSelectValue("");
      return;
    }
    const found = categorias.find(
      (c) => c.nome.toLowerCase() === value.toLowerCase(),
    );
    setSelectValue(found?.nome ?? value);
  }, [value, categorias, mostrandoNova]);

  /**
   * Cria categoria na tabela e seleciona o nome gerado.
   */
  async function criarNova() {
    const nome = novaNome.trim();
    if (!nome) return toast.error("Informe o nome da nova categoria");
    const slug = slugifyNome(nome);
    if (!slug) return toast.error("Nome de categoria inválido");

    const existente = categorias.find(
      (c) => c.slug === slug || c.nome.toLowerCase() === nome.toLowerCase(),
    );
    if (existente) {
      onChange(existente.nome);
      setSelectValue(existente.nome);
      setNovaNome("");
      return;
    }

    setBusy(true);
    const maxOrdem = categorias.reduce((m, c) => Math.max(m, Number(c.ordem) || 0), 0);
    const { data, error } = await supabase
      .from("bike_categorias")
      .insert({ nome, slug, ordem: maxOrdem + 10 })
      .select("nome")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);

    await qc.invalidateQueries({ queryKey: ["bike-categorias"] });
    onChange(data.nome);
    setSelectValue(data.nome);
    setNovaNome("");
    toast.success(`Categoria "${data.nome}" criada`);
  }

  return (
    <div className="space-y-2">
      <select
        disabled={disabled || busy}
        value={mostrandoNova ? NOVA : selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NOVA) {
            setSelectValue(NOVA);
            setNovaNome("");
            return;
          }
          setSelectValue(v);
          onChange(v);
        }}
        className={
          className ??
          "h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
        }
      >
        <option value="">—</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.nome}>
            {c.nome}
          </option>
        ))}
        {value &&
          !categorias.some((c) => c.nome.toLowerCase() === value.toLowerCase()) && (
            <option value={value}>{value}</option>
          )}
        <option value={NOVA}>+ Nova categoria…</option>
      </select>
      {mostrandoNova && (
        <div className="flex gap-2">
          <Input
            disabled={disabled || busy}
            placeholder="Ex.: Enduro, Dirt…"
            value={novaNome}
            onChange={(e) => setNovaNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void criarNova();
              }
            }}
            autoFocus
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void criarNova()}
            className="h-9 shrink-0 rounded-md border bg-background px-3 text-xs font-medium hover:bg-secondary disabled:opacity-50"
          >
            {busy ? "…" : "Criar"}
          </button>
        </div>
      )}
    </div>
  );
}
