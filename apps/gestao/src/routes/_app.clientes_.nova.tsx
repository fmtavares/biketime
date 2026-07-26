import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppLayout";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";

export const Route = createFileRoute("/_app/clientes_/nova")({
  component: NovoClientePage,
});

/**
 * Atalho de menu para abrir o formulário de novo cliente.
 */
function NovoClientePage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  /**
   * Fecha o dialog e volta à lista de clientes.
   */
  function fechar(v: boolean) {
    setOpen(v);
    if (!v) navigate({ to: "/clientes" });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Novo cliente"
        description="Cadastre um novo cliente"
      />
      <p className="text-sm text-muted-foreground">
        Preencha o formulário para criar o cadastro.
      </p>
      <ClienteFormDialog
        open={open}
        onOpenChange={fechar}
        onSaved={() => {
          setOpen(false);
          navigate({ to: "/clientes" });
        }}
      />
    </div>
  );
}
