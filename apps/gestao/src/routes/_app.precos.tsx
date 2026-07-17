import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/precos")({
  component: PrecosPage,
});

type Servico = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  valor: number;
};

function PrecosPage() {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Servico | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", valor: "" });
  const [busy, setBusy] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["servicos-precos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("servicos_precos")
        .select("*")
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as Servico[];
    },
  });

  const openNew = () => {
    setEdit(null);
    setForm({ nome: "", descricao: "", valor: "" });
    setOpen(true);
  };

  const openEdit = (s: Servico) => {
    setEdit(s);
    setForm({
      nome: s.nome,
      descricao: s.descricao ?? "",
      valor: String(s.valor),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const valor = Number(String(form.valor).replace(",", "."));
    if (isNaN(valor) || valor < 0) {
      toast.error("Valor inválido");
      return;
    }
    setBusy(true);
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      valor,
    };
    const { error } = edit
      ? await supabase.from("servicos_precos").update(payload).eq("id", edit.id)
      : await supabase.from("servicos_precos").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Serviço atualizado" : "Serviço criado");
    setOpen(false);
    refetch();
  };

  const remove = async (s: Servico) => {
    if (!confirm(`Remover o serviço "${s.nome}"?`)) return;
    const { error } = await supabase.from("servicos_precos").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Serviço removido");
    refetch();
  };

  const fmtMoney = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Preços"
        description="Tabela de serviços e valores"
        action={
          isAdmin ? (
            <Button onClick={openNew}>
              <Plus className="size-4" /> Novo serviço
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Código</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right w-[140px]">Valor</TableHead>
              {isAdmin && <TableHead className="w-[110px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Nenhum serviço cadastrado.
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">
                  {s.codigo}
                </TableCell>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {s.descricao || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {fmtMoney(Number(s.valor))}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{edit ? "Editar serviço" : "Novo serviço"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do serviço</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Revisão completa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="O que está incluso neste serviço"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
