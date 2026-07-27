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

export type ClienteOption = {
  id: string;
  nome: string;
  whatsapp?: string | null;
  email?: string | null;
};

/**
 * Combobox de cliente com busca por nome, WhatsApp ou e-mail.
 */
export function ClienteCombobox({
  clientes,
  value,
  onChange,
  placeholder = "Buscar cliente…",
  disabled,
}: {
  clientes: ClienteOption[];
  value: string;
  onChange: (clienteId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const selecionado = useMemo(
    () => clientes.find((c) => c.id === value) ?? null,
    [clientes, value],
  );

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
            {selecionado?.nome ?? placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            const s = search.toLowerCase().trim();
            if (!s) return 1;
            return itemValue.toLowerCase().includes(s) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Digite nome, WhatsApp ou e-mail…" />
          <CommandList>
            <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
            <CommandGroup>
              {clientes.map((c) => {
                const searchValue = [c.nome, c.whatsapp, c.email]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <CommandItem
                    key={c.id}
                    value={searchValue}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === c.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.nome}</div>
                      {(c.whatsapp || c.email) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {[c.whatsapp, c.email].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
