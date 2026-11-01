import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GradeSlug = "bike_cm" | "bike_letra" | "livre";

type GradeRow = {
  id: string;
  slug: string;
  nome: string;
  tamanho_grade_itens: { valor: string; ordem: number }[];
};

/**
 * Inferência simples do tipo de grade a partir do valor já salvo.
 */
function inferModo(valor: string | null | undefined): GradeSlug {
  const v = (valor ?? "").trim().toUpperCase();
  if (!v) return "bike_cm";
  if (["P", "M", "G"].includes(v)) return "bike_letra";
  if (/^\d{2}$/.test(v)) return "bike_cm";
  return "livre";
}

/**
 * Select de tamanho para bikes: grades cm / letra ou texto livre.
 * Documenta a escolha do tipo e preenche o valor a partir dos itens da grade.
 */
export function TamanhoSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [modo, setModo] = useState<GradeSlug>(() => inferModo(value));

  const { data: grades = [] } = useQuery({
    queryKey: ["tamanho-grades-bike"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tamanho_grades")
        .select("id, slug, nome, tamanho_grade_itens(valor, ordem)")
        .in("slug", ["bike_cm", "bike_letra"])
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as GradeRow[];
    },
  });

  const itens = useMemo(() => {
    const g = grades.find((x) => x.slug === modo);
    return [...(g?.tamanho_grade_itens ?? [])].sort((a, b) => a.ordem - b.ordem);
  }, [grades, modo]);

  useEffect(() => {
    // Se o valor atual não bate com o modo (ex.: usuário trocou tipo), limpa seleção
    if (modo === "livre") return;
    if (!value) return;
    if (itens.length === 0) return;
    const ok = itens.some((i) => i.valor === value);
    if (!ok && inferModo(value) !== modo) {
      // mantém valor legado até o usuário escolher
    }
  }, [modo, itens, value]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <select
          disabled={disabled}
          value={modo}
          onChange={(e) => {
            const next = e.target.value as GradeSlug;
            setModo(next);
            if (next === "livre") return;
            onChange("");
          }}
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Tipo de grade de tamanho"
        >
          <option value="bike_cm">Quadro (cm)</option>
          <option value="bike_letra">Letra (P/M/G)</option>
          <option value="livre">Livre</option>
        </select>
        {modo === "livre" ? (
          <Input
            id={id}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex.: 51, XL…"
            className="min-w-[8rem] flex-1"
          />
        ) : (
          <select
            id={id}
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-[8rem] flex-1 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Selecione…</option>
            {itens.map((i) => (
              <option key={i.valor} value={i.valor}>
                {i.valor}
              </option>
            ))}
            {value && !itens.some((i) => i.valor === value) && (
              <option value={value}>{value} (atual)</option>
            )}
          </select>
        )}
      </div>
      <Label className="sr-only">Tamanho</Label>
    </div>
  );
}
