import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtBRL } from "@/lib/finance";
import { labelCompetencia } from "@/lib/despesas";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export type FechamentoCalItem = {
  key: string;
  origem: "compra" | "operacional";
  data: string;
  titulo: string;
  detalhe: string;
  valor: number;
};

/**
 * Monta as células do calendário (segunda → domingo) para o mês YYYY-MM.
 */
function montarGrade(mesRef: string) {
  const [ano, mes] = mesRef.split("-").map(Number);
  const primeiro = new Date(ano, mes - 1, 1);
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
 * Modal grande com calendário das saídas pagas do fechamento (compras + operacional).
 */
export function FechamentoCalendarioDialog({
  open,
  onOpenChange,
  mesRef,
  competencia,
  linhas,
  today,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mesRef: string;
  competencia: string;
  linhas: FechamentoCalItem[];
  today: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  /** Ao fechar o modal, volta do modo tela cheia. */
  useEffect(() => {
    if (!open) setFullscreen(false);
  }, [open]);

  const grade = useMemo(() => montarGrade(mesRef), [mesRef]);

  const porDia = useMemo(() => {
    const map = new Map<string, FechamentoCalItem[]>();
    for (const l of linhas) {
      if (!l.data) continue;
      if (!map.has(l.data)) map.set(l.data, []);
      map.get(l.data)!.push(l);
    }
    return map;
  }, [linhas]);

  const totais = useMemo(() => {
    let compras = 0;
    let operacional = 0;
    for (const l of linhas) {
      if (l.origem === "compra") compras += l.valor;
      else operacional += l.valor;
    }
    return { compras, operacional, total: compras + operacional };
  }, [linhas]);

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
            Saídas pagas do mês posicionadas pelo vencimento (não pela data do clique em Pagar)
          </DialogDescription>
          <div className="flex flex-wrap gap-3 pt-2 text-sm">
            <span>
              Total{" "}
              <strong className="font-semibold">{fmtBRL(totais.total)}</strong>
            </span>
            <span>
              Compras{" "}
              <strong className="font-semibold">{fmtBRL(totais.compras)}</strong>
            </span>
            <span>
              Operacional{" "}
              <strong className="font-semibold">{fmtBRL(totais.operacional)}</strong>
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
                      {fmtBRL(items.reduce((s, i) => s + i.valor, 0))}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((l) => (
                      <ChipFechamento key={l.key} item={l} />
                    ))}
                  </div>
                </div>
              ))}
            {porDia.size === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma saída paga neste mês.
              </p>
            )}
          </div>

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
                const diaTotal = items.reduce((s, i) => s + i.valor, 0);
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
                      {items.map((l) => (
                        <ChipFechamento key={l.key} item={l} compact />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-secondary-foreground/40" />{" "}
              Compra
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" /> Operacional
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Chip de saída paga no calendário do fechamento.
 */
function ChipFechamento({
  item,
  compact,
}: {
  item: FechamentoCalItem;
  compact?: boolean;
}) {
  const compra = item.origem === "compra";
  const tone = compra
    ? "border-border bg-secondary/60 text-foreground"
    : "border-primary/30 bg-primary/10 text-primary";

  return (
    <div
      className={`w-full rounded-md border text-left ${tone} ${
        compact ? "px-1.5 py-1" : "px-2.5 py-2"
      }`}
      title={[item.titulo, item.detalhe, fmtBRL(item.valor)]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className={`truncate font-medium ${compact ? "text-[11px]" : "text-sm"}`}>
        {item.titulo}
      </div>
      <div
        className={`flex items-center justify-between gap-1 ${
          compact ? "text-[10px]" : "mt-0.5 text-xs"
        }`}
      >
        <span className="truncate opacity-80">
          {compact
            ? fmtBRL(item.valor)
            : item.origem === "compra"
              ? "Compra"
              : "Operacional"}
        </span>
        {!compact && (
          <span className="shrink-0 font-semibold">{fmtBRL(item.valor)}</span>
        )}
      </div>
      {!compact && (
        <div className="mt-0.5 truncate text-[11px] opacity-70">{item.detalhe}</div>
      )}
    </div>
  );
}
