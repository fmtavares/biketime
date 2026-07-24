import { Input } from "@/components/ui/input";

/**
 * Formata número como moeda BRL para exibição.
 */
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Input com máscara monetária (centavos → valor numérico em string).
 * Digitar 41230 exibe R$ 412,30 e chama onChange("412.3").
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder = "R$ 0,00",
  disabled,
  className,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const num =
    typeof value === "number"
      ? value
      : value === "" || value == null
        ? null
        : Number(String(value).replace(",", "."));
  const display =
    num == null || Number.isNaN(num) || num === 0 ? "" : brl(num);

  return (
    <Input
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      disabled={disabled}
      className={className}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) return onChange("");
        onChange(String(Number(digits) / 100));
      }}
    />
  );
}
