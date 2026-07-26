import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppLayout";
import { OSFormDialog } from "@/components/OSFormDialog";

export const Route = createFileRoute("/_app/oficina_/nova")({
  component: NovaOrdemPage,
});

/**
 * Atalho de menu para abrir o formulário de nova ordem de serviço.
 */
function NovaOrdemPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);

  /**
   * Fecha o dialog e volta ao Painel da oficina.
   */
  function fechar(v: boolean) {
    setOpen(v);
    if (!v) navigate({ to: "/oficina" });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Nova ordem"
        description="Cadastre uma nova ordem de serviço"
      />
      <p className="text-sm text-muted-foreground">
        Preencha o formulário para abrir a OS.
      </p>
      <OSFormDialog
        open={open}
        onOpenChange={fechar}
        onSaved={() => {
          setOpen(false);
          navigate({ to: "/oficina" });
        }}
      />
    </div>
  );
}
