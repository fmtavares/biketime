import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCnpj, formatPhoneBr } from "@/lib/utils";

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

type FornecedorForm = {
  id?: string;
  nome: string;
  nome_fantasia: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  observacoes: string;
  ativo: boolean;
};

const empty: FornecedorForm = {
  nome: "",
  nome_fantasia: "",
  cnpj: "",
  contato: "",
  telefone: "",
  email: "",
  cidade: "",
  estado: "",
  observacoes: "",
  ativo: true,
};

/**
 * Dialog de criar/editar fornecedor.
 */
export function FornecedorFormDialog({
  open,
  onOpenChange,
  fornecedor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor?: any | null;
  onSaved?: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState<FornecedorForm>(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (fornecedor) {
      setForm({
        ...empty,
        ...fornecedor,
        nome: fornecedor.nome ?? "",
        nome_fantasia: fornecedor.nome_fantasia ?? "",
        cnpj: formatCnpj(fornecedor.cnpj ?? ""),
        contato: fornecedor.contato ?? "",
        telefone: formatPhoneBr(fornecedor.telefone ?? ""),
        email: fornecedor.email ?? "",
        cidade: fornecedor.cidade ?? "",
        estado: fornecedor.estado ?? "",
        observacoes: fornecedor.observacoes ?? "",
        ativo: fornecedor.ativo !== false,
      });
    } else {
      setForm(empty);
    }
  }, [open, fornecedor]);

  const set = (k: keyof FornecedorForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!isAdmin) return toast.error("Somente administradores");
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setBusy(true);

    const payload = {
      nome: form.nome.trim(),
      nome_fantasia: form.nome_fantasia.trim() || null,
      cnpj: form.cnpj.replace(/\D/g, "") || null,
      contato: form.contato.trim() || null,
      telefone: form.telefone.replace(/\D/g, "") || null,
      email: form.email.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado || null,
      observacoes: form.observacoes.trim() || null,
      ativo: !!form.ativo,
    };

    const { error } = form.id
      ? await supabase.from("fornecedores").update(payload).eq("id", form.id)
      : await supabase
          .from("fornecedores")
          .insert({ ...payload, created_by: user?.id ?? null });

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Fornecedor atualizado" : "Fornecedor criado");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Nome / Razão social *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome fantasia</Label>
            <Input
              value={form.nome_fantasia}
              onChange={(e) => set("nome_fantasia", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CNPJ</Label>
            <Input
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contato</Label>
            <Input value={form.contato} onChange={(e) => set("contato", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              value={form.telefone}
              onChange={(e) => set("telefone", formatPhoneBr(e.target.value))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <select
              value={form.estado}
              onChange={(e) => set("estado", e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={3}
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => set("ativo", v)}
              id="forn-ativo"
            />
            <Label htmlFor="forn-ativo">Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
