import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FechamentoCalendarioDialog } from "@/components/FechamentoCalendarioDialog";
import { fmtBRL } from "@/lib/finance";
import {
  competenciaAtual,
  competenciaMes,
  labelCompetencia,
} from "@/lib/despesas";
import { faixaMesLocalISO, fmtDataLocal, toDataLocal } from "@/lib/datas";

export const Route = createFileRoute("/_app/fechamento")({
  component: FechamentoPage,
});

type LinhaFechamento =
  | {
      key: string;
      origem: "compra";
      /** Dia do vencimento (programação / calendário). */
      data_vencimento: string;
      /** Dia do pagamento no fuso local (visão de caixa). */
      data_pagamento: string;
      titulo: string;
      detalhe: string;
      valor: number;
    }
  | {
      key: string;
      origem: "operacional";
      data_vencimento: string;
      data_pagamento: string;
      titulo: string;
      detalhe: string;
      valor: number;
      categoria: string;
    };

/**
 * Fechamento mensal de caixa: parcelas de compra pagas + despesas pagas no mês.
 */
function FechamentoPage() {
  const [mesRef, setMesRef] = useState(() => competenciaAtual().slice(0, 7));
  const [openCalendario, setOpenCalendario] = useState(false);
  const { inicio, fim, ano, mes } = faixaMesLocalISO(mesRef);
  const competencia = competenciaMes(ano, mes);
  const today = toDataLocal(new Date().toISOString());

  const { data: parcelas = [], isLoading: loadingP } = useQuery({
    queryKey: ["fechamento", "parcelas", mesRef],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compra_parcelas")
        .select(
          "id, numero, valor, data_vencimento, data_pagamento, compras(numero_nf, forma_pagamento, fornecedores(nome))",
        )
        .eq("status", "paga")
        .gte("data_pagamento", inicio)
        .lt("data_pagamento", fim)
        .order("data_pagamento", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((p: any): Extract<LinhaFechamento, { origem: "compra" }> => {
        const compra = p.compras;
        const forn = compra?.fornecedores?.nome ?? "Fornecedor";
        const nf = compra?.numero_nf ? `NF ${compra.numero_nf}` : null;
        return {
          key: `c-${p.id}`,
          origem: "compra",
          data_vencimento: toDataLocal(p.data_vencimento),
          data_pagamento: toDataLocal(p.data_pagamento),
          titulo: forn,
          detalhe: [`Parcela #${p.numero}`, compra?.forma_pagamento, nf]
            .filter(Boolean)
            .join(" · "),
          valor: Number(p.valor) || 0,
        };
      });
    },
  });

  const { data: despesas = [], isLoading: loadingD } = useQuery({
    queryKey: ["fechamento", "despesas", mesRef],
    queryFn: async () => {
      const { data: porPagamento, error: e1 } = await supabase
        .from("despesas")
        .select("*, despesa_categorias(nome)")
        .eq("status", "paga")
        .gte("data_pagamento", inicio)
        .lt("data_pagamento", fim)
        .order("data_pagamento", { ascending: true });
      if (e1) throw e1;

      const { data: porCompetencia, error: e2 } = await supabase
        .from("despesas")
        .select("*, despesa_categorias(nome)")
        .eq("status", "paga")
        .eq("competencia", competencia)
        .is("data_pagamento", null)
        .order("data_vencimento", { ascending: true });
      if (e2) throw e2;

      const seen = new Set<string>();
      const rows: Extract<LinhaFechamento, { origem: "operacional" }>[] = [];

      for (const d of [...(porPagamento ?? []), ...(porCompetencia ?? [])] as any[]) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        const cat = d.despesa_categorias?.nome ?? "Sem categoria";
        const venc = toDataLocal(d.data_vencimento);
        const paga = toDataLocal(d.data_pagamento) || venc;
        rows.push({
          key: `d-${d.id}`,
          origem: "operacional",
          data_vencimento: venc,
          data_pagamento: paga,
          titulo: d.descricao,
          detalhe: [cat, d.forma_pagamento].filter(Boolean).join(" · "),
          valor: Number(d.valor) || 0,
          categoria: cat,
        });
      }

      rows.sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento));
      return rows;
    },
  });

  const linhas = useMemo(() => {
    const all: LinhaFechamento[] = [...parcelas, ...despesas];
    all.sort((a, b) => a.data_pagamento.localeCompare(b.data_pagamento));
    return all;
  }, [parcelas, despesas]);

  /** Itens do calendário: posicionados pelo vencimento (não pelo clique em Pagar). */
  const linhasCalendario = useMemo(
    () =>
      linhas.map((l) => ({
        key: l.key,
        origem: l.origem,
        data: l.data_vencimento,
        titulo: l.titulo,
        detalhe: l.detalhe,
        valor: l.valor,
      })),
    [linhas],
  );

  const resumo = useMemo(() => {
    let compras = 0;
    let operacional = 0;
    const porCategoria = new Map<string, number>();

    for (const l of linhas) {
      if (l.origem === "compra") {
        compras += l.valor;
      } else {
        operacional += l.valor;
        porCategoria.set(
          l.categoria,
          (porCategoria.get(l.categoria) ?? 0) + l.valor,
        );
      }
    }

    const categorias = Array.from(porCategoria.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);

    return {
      compras,
      operacional,
      total: compras + operacional,
      categorias,
    };
  }, [linhas]);

  const isLoading = loadingP || loadingD;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Fechamento"
        description={`Saídas pagas em ${labelCompetencia(competencia)} (visão de caixa)`}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => setOpenCalendario(true)}>
              <CalendarDays className="size-4" /> Programação do mês
            </Button>
            <input
              type="month"
              value={mesRef}
              onChange={(e) => setMesRef(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              aria-label="Mês do fechamento"
            />
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <ResumoCard label="Total saiu" value={resumo.total} destaque />
        <ResumoCard label="Compras (fornecedor)" value={resumo.compras} />
        <ResumoCard label="Operacional" value={resumo.operacional} />
      </div>

      {resumo.categorias.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium mb-2">Operacional por categoria</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {resumo.categorias.map((c) => (
              <div
                key={c.nome}
                className="rounded-lg border bg-card px-3 py-2 flex items-center justify-between gap-2"
              >
                <span className="text-sm text-muted-foreground truncate">
                  {c.nome}
                </span>
                <span className="text-sm font-semibold shrink-0">
                  {fmtBRL(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Movimentações pagas</h2>
        <p className="text-xs text-muted-foreground">
          Agenda do dia a dia em{" "}
          <Link to="/contas-a-pagar" className="underline hover:text-foreground">
            A Pagar
          </Link>
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="rounded-xl border bg-card px-8 py-16 text-center text-muted-foreground">
          Nenhuma saída paga neste mês.
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:hidden">
            {linhas.map((l) => (
              <div key={l.key} className="rounded-xl border bg-card p-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <OrigemBadge origem={l.origem} />
                      <span className="font-medium">{l.titulo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {l.detalhe}
                    </div>
                  </div>
                  <div className="font-semibold">{fmtBRL(l.valor)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Venc. {fmtDataLocal(l.data_vencimento)}
                  {" · "}
                  Pago em {fmtDataLocal(l.data_pagamento)}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Vencimento</th>
                  <th className="text-left px-4 py-3">Pago em</th>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-left px-4 py-3">Descrição</th>
                  <th className="text-left px-4 py-3">Detalhe</th>
                  <th className="text-right px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.key} className="border-t">
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDataLocal(l.data_vencimento)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDataLocal(l.data_pagamento)}
                    </td>
                    <td className="px-4 py-3">
                      <OrigemBadge origem={l.origem} />
                    </td>
                    <td className="px-4 py-3 font-medium">{l.titulo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.detalhe}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {fmtBRL(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-secondary/30">
                  <td colSpan={5} className="px-4 py-3 text-right font-medium">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-display font-bold">
                    {fmtBRL(resumo.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <FechamentoCalendarioDialog
        open={openCalendario}
        onOpenChange={setOpenCalendario}
        mesRef={mesRef}
        competencia={competencia}
        linhas={linhasCalendario}
        today={today}
      />
    </div>
  );
}

/** Badge Compra / Operacional. */
function OrigemBadge({ origem }: { origem: "compra" | "operacional" }) {
  return origem === "compra" ? (
    <Badge variant="secondary">Compra</Badge>
  ) : (
    <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
      Operacional
    </Badge>
  );
}

/** Card de resumo do fechamento. */
function ResumoCard({
  label,
  value,
  destaque,
}: {
  label: string;
  value: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? "bg-primary/5 border-primary/30" : "bg-card"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-display font-bold">{fmtBRL(value)}</div>
    </div>
  );
}
