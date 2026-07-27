import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtBRL } from "@/lib/finance";

export type ServicoOption = {
  id: string;
  nome: string;
  valor: number;
};

/**
 * Combobox de serviços do catálogo com busca digitável por nome.
 * Mantém o serviço selecionado visível no botão após fechar a lista.
 */
export function ServicoCombobox({
  servicos,
  value,
  onChange,
  placeholder = "Buscar serviço…",
  disabled,
}: {
  servicos: ServicoOption[];
  value: string;
  onChange: (servicoId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selecionado = useMemo(
    () => servicos.find((s) => s.id === value) ?? null,
    [servicos, value],
  );

  /**
   * Confirma a escolha e fecha o popover (mousedown evita perder o valor no Dialog).
   */
  function escolher(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selecionado && "text-muted-foreground")}>
            {selecionado
              ? `${selecionado.nome} · ${fmtBRL(Number(selecionado.valor) || 0)}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* key remonta o Command ao abrir — limpa o texto da busca */}
        <Command
          key={open ? "open" : "closed"}
          filter={(itemValue, search) => {
            const s = search.toLowerCase().trim();
            if (!s) return 1;
            return itemValue.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Digite para buscar…" />
          <CommandList>
            <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
            <CommandGroup>
              {servicos.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.nome} ${s.id}`}
                  onSelect={() => escolher(s.id)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(s.id);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      value === s.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{s.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtBRL(Number(s.valor) || 0)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
