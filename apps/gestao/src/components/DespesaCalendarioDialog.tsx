import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBRL } from "@/lib/finance";
import { labelCompetencia } from "@/lib/despesas";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type DespesaCal = {
  id: string;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
  despesa_categorias?: { nome?: string } | null;
  recorrente_id?: string | null;
};

/**
 * Monta as células do calendário (segunda → domingo) para o mês YYYY-MM.
 */
function montarGrade(mesRef: string) {
  const [ano, mes] = mesRef.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
  // JS: 0=dom … 6=sáb → converter para segunda=0
  const offset = (primeiro.getDay() + 6) % 7;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const celulas: ({ dia: number; data: string } | null)[] = [];

  for (let i = 0; i < offset; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${mesRef}-${String(d).padStart(2, "0")}`;
    celulas.push({ dia: d, data });
  }
  while (celulas.length % 7 !== 0) celulas.push(null);

  return celulas;
}

/**
 * Modal grande com programação de custos do mês (só despesas operacionais).
 */
export function DespesaCalendarioDialog({
  open,
  onOpenChange,
  mesRef,
  competencia,
  despesas,
  today,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mesRef: string;
  competencia: string;
  despesas: DespesaCal[];
  today: string;
  onSelect?: (d: DespesaCal) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  /** Ao fechar o modal, volta do modo tela cheia. */
  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  const grade = useMemo(() => montarGrade(mesRef), [mesRef]);

  const porDia = useMemo(() => {
    const map = new Map<string, DespesaCal[]>();
    for (const d of despesas) {
      const key = d.data_vencimento;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [despesas]);

  const totais = useMemo(() => {
    let previstas = 0;
    let pagas = 0;
    let vencidas = 0;
    for (const d of despesas) {
      const v = Number(d.valor) || 0;
      if (d.status === "paga") pagas += v;
      else {
        previstas += v;
        if (d.data_vencimento < today) vencidas += v;
      }
    }
    return { previstas, pagas, vencidas, total: previstas + pagas };
  }, [despesas, today]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          fullscreen
            ? "h-screen max-h-screen w-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0"
            : "max-h-[92vh] w-[95vw] max-w-6xl sm:rounded-xl",
        )}
      >
        <DialogHeader className="relative shrink-0 space-y-1 border-b px-5 py-4 pr-24 text-left">
          <DialogTitle className="font-display text-xl">
            Programação · {labelCompetencia(competencia)}
          </DialogTitle>
          <DialogDescription>
            Visão de custos operacionais do mês por vencimento
          </DialogDescription>
          <div className="flex flex-wrap gap-3 pt-2 text-sm">
            <span>
              Previstas{" "}
              <strong className="font-semibold">{fmtBRL(totais.previstas)}</strong>
            </span>
            <span className="text-destructive">
              Vencidas{" "}
              <strong className="font-semibold">{fmtBRL(totais.vencidas)}</strong>
            </span>
            <span>
              Pagas{" "}
              <strong className="font-semibold">{fmtBRL(totais.pagas)}</strong>
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-12 top-3 size-8"
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            aria-label={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={() => setFullscreen((v) => !v)}
          >
            {fullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {/* Mobile: lista por dia com lançamentos */}
          <div className="space-y-3 md:hidden">
            {Array.from(porDia.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([data, items]) => (
                <div key={data} className="rounded-xl border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {new Date(data + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtBRL(items.reduce((s, i) => s + (Number(i.valor) || 0), 0))}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((d) => (
                      <ChipDespesa
                        key={d.id}
                        d={d}
                        today={today}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            {porDia.size === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma despesa programada neste mês.
              </p>
            )}
          </div>

          {/* Desktop: grade de calendário */}
          <div className="hidden md:block">
            <div className="mb-2 grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="px-1 py-1 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grade.map((cel, idx) => {
                const minH = fullscreen ? "min-h-[140px]" : "min-h-[110px]";
                if (!cel) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className={`${minH} rounded-lg bg-muted/20`}
                    />
                  );
                }
                const items = porDia.get(cel.data) ?? [];
                const isToday = cel.data === today;
                const diaTotal = items.reduce(
                  (s, i) => s + (Number(i.valor) || 0),
                  0,
                );
                return (
                  <div
                    key={cel.data}
                    className={`flex ${minH} flex-col rounded-lg border p-1.5 ${
                      isToday
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/80 bg-card"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {cel.dia}
                      </span>
                      {items.length > 0 && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {fmtBRL(diaTotal)}
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
                      {items.map((d) => (
                        <ChipDespesa
                          key={d.id}
                          d={d}
                          today={today}
                          onSelect={onSelect}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" /> Prevista
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-destructive" /> Vencida
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-600" /> Paga
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Chip de despesa no calendário; clique abre edição.
 */
function ChipDespesa({
  d,
  today,
  onSelect,
  compact,
}: {
  d: DespesaCal;
  today: string;
  onSelect?: (d: DespesaCal) => void;
  compact?: boolean;
}) {
  const vencida = d.status === "prevista" && d.data_vencimento < today;
  const paga = d.status === "paga";

  const tone = paga
    ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
    : vencida
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(d)}
      className={`w-full rounded-md border text-left transition-opacity hover:opacity-90 ${tone} ${
        compact ? "px-1.5 py-1" : "px-2.5 py-2"
      }`}
      title={[
        d.descricao,
        d.despesa_categorias?.nome,
        fmtBRL(Number(d.valor) || 0),
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className={`truncate font-medium ${compact ? "text-[11px]" : "text-sm"}`}>
        {d.descricao}
      </div>
      <div
        className={`flex items-center justify-between gap-1 ${
          compact ? "text-[10px]" : "mt-0.5 text-xs"
        }`}
      >
        <span className="truncate opacity-80">
          {compact
            ? fmtBRL(Number(d.valor) || 0)
            : d.despesa_categorias?.nome ?? "—"}
        </span>
        {!compact && (
          <span className="shrink-0 font-semibold">
            {fmtBRL(Number(d.valor) || 0)}
          </span>
        )}
      </div>
      {!compact && (
        <div className="mt-1">
          {paga ? (
            <Badge variant="secondary" className="text-[10px]">
              Paga
            </Badge>
          ) : (
            <Badge
              variant={vencida ? "destructive" : "outline"}
              className="text-[10px]"
            >
              {vencida ? "Vencida" : "Prevista"}
            </Badge>
          )}
        </div>
      )}
    </button>
  );
}
