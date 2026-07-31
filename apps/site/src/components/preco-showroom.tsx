import { calcDesconto, fmtPreco } from "@/lib/loja";

type PrecoShowroomProps = {
  valorMercado?: number | null;
  valorPromocional?: number | null;
  /** Tamanho visual: card (lista) ou detalhe (página). */
  size?: "card" | "detalhe";
};

/**
 * Exibe preço do showroom: mercado riscado + badge de desconto + valor promocional.
 * Se não houver desconto válido, mostra só o preço promocional.
 */
export function PrecoShowroom({
  valorMercado,
  valorPromocional,
  size = "card",
}: PrecoShowroomProps) {
  const { mercado, promocional, descontoPct } = calcDesconto(
    valorMercado,
    valorPromocional,
  );

  const precoClass =
    size === "detalhe"
      ? "font-display text-3xl font-bold text-primary"
      : "font-display text-lg font-bold text-primary";

  if (!descontoPct) {
    return <div className={precoClass}>{fmtPreco(promocional)}</div>;
  }

  return (
    <div className={size === "detalhe" ? "mt-0 space-y-2" : "space-y-1"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            size === "detalhe"
              ? "text-base text-muted-foreground line-through"
              : "text-sm text-muted-foreground line-through"
          }
        >
          {fmtPreco(mercado)}
        </span>
        <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
          -{descontoPct}% OFF
        </span>
      </div>
      <div className={precoClass}>{fmtPreco(promocional)}</div>
    </div>
  );
}
