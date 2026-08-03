import { ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormatoEtiquetaOS } from "@/lib/os-etiqueta";

/** Tipos de etiqueta de OS disponíveis no menu. */
export type TipoEtiquetaOS = FormatoEtiquetaOS;

type Props = {
  /** Chamado ao escolher o formato da etiqueta. */
  onSelect: (tipo: TipoEtiquetaOS) => void;
  disabled?: boolean;
  /** Texto do botão; omitir em modo só ícone. */
  label?: string;
  /** Só ícone (lista desktop). */
  iconOnly?: boolean;
  size?: "default" | "sm" | "icon";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
};

/**
 * Botão "Etiqueta" com submenu: OS dupla, simples e pequena.
 */
export function OSEtiquetaMenuButton({
  onSelect,
  disabled,
  label = "Etiqueta",
  iconOnly = false,
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size={iconOnly ? "sm" : size}
          variant={variant}
          disabled={disabled}
          className={iconOnly ? `gap-0.5 px-2 ${className ?? ""}` : className}
          title="Imprimir etiqueta"
          aria-label="Imprimir etiqueta"
          onClick={(e) => e.stopPropagation()}
        >
          <Printer className="size-4" />
          {!iconOnly && <span>{label}</span>}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem onSelect={() => onSelect("dupla")}>
          OS dupla
          <span className="ml-auto text-xs text-muted-foreground">100×150</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("simples")}>
          OS simples
          <span className="ml-auto text-xs text-muted-foreground">78×70</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect("pequena")}>
          OS pequena
          <span className="ml-auto text-xs text-muted-foreground">40×25 · gap 2</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
