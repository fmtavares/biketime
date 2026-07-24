import { supabase } from "@/integrations/supabase/client";
import { competenciaMes, vencimentoNoMes } from "@/lib/despesas";

type RecorrenteLike = {
  id: string;
  descricao: string;
  categoria_id: string | null;
  dia_vencimento: number;
  valor_estimado: number | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  ativo?: boolean;
};

/**
 * Monta o payload de lançamento previsto a partir de um recorrente.
 */
function rowFromRecorrente(
  r: RecorrenteLike,
  ano: number,
  mes: number,
  createdBy: string | null,
) {
  return {
    descricao: r.descricao,
    categoria_id: r.categoria_id,
    recorrente_id: r.id,
    data_vencimento: vencimentoNoMes(ano, mes, r.dia_vencimento),
    competencia: competenciaMes(ano, mes),
    valor: Number(r.valor_estimado) || 0,
    forma_pagamento: r.forma_pagamento,
    status: "prevista" as const,
    observacoes: r.observacoes,
    created_by: createdBy,
  };
}

/**
 * Garante lançamentos do mês para todos os recorrentes ativos.
 * Ignora duplicatas (mesmo recorrente + competência).
 */
export async function garantirLancamentosDoMes(opts: {
  ano: number;
  mes: number;
  createdBy?: string | null;
}): Promise<{ criados: number; pulados: number; error?: string }> {
  const { data, error } = await supabase
    .from("despesa_recorrentes")
    .select(
      "id, descricao, categoria_id, dia_vencimento, valor_estimado, forma_pagamento, observacoes, ativo",
    )
    .eq("ativo", true);

  if (error) return { criados: 0, pulados: 0, error: error.message };

  return inserirLancamentos(data ?? [], opts.ano, opts.mes, opts.createdBy ?? null);
}

/**
 * Garante o lançamento do mês atual para um único recorrente (após cadastro/edição).
 */
export async function garantirLancamentoRecorrente(opts: {
  recorrente: RecorrenteLike;
  ano: number;
  mes: number;
  createdBy?: string | null;
}): Promise<{ criados: number; pulados: number; error?: string }> {
  if (opts.recorrente.ativo === false) {
    return { criados: 0, pulados: 0 };
  }
  return inserirLancamentos(
    [opts.recorrente],
    opts.ano,
    opts.mes,
    opts.createdBy ?? null,
  );
}

/**
 * Insere lançamentos; trata unique violation como “já existia”.
 */
async function inserirLancamentos(
  recorrentes: RecorrenteLike[],
  ano: number,
  mes: number,
  createdBy: string | null,
): Promise<{ criados: number; pulados: number; error?: string }> {
  let criados = 0;
  let pulados = 0;

  for (const r of recorrentes) {
    const { error } = await supabase
      .from("despesas")
      .insert(rowFromRecorrente(r, ano, mes, createdBy));
    if (error) {
      if (error.code === "23505") pulados += 1;
      else return { criados, pulados, error: error.message };
    } else {
      criados += 1;
    }
  }

  return { criados, pulados };
}
