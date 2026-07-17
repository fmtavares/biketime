import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function PendenciaFormDialog({
  open,
  onOpenChange,
  pendencia,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendencia?: any;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    atividade: "",
    tipo_atividade: "",
    data_prevista: "",
    responsavel_id: "",
    privado: false,
    concluida: false,
  });
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([]);
  const [tipos, setTipos] = useState<{ id: string; nome: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (supabase.from as any)("tipo_atividade")
      .select("id, nome")
      .order("nome", { ascending: true })
      .then(({ data }: any) => setTipos(data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name", { ascending: true })
      .then(({ data }) => setProfiles(data ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (pendencia) {
      setForm({
        atividade: pendencia.atividade ?? "",
        tipo_atividade: pendencia.tipo_atividade ?? "",
        data_prevista: pendencia.data_prevista ?? "",
        responsavel_id: pendencia.responsavel_id ?? "",
        privado: !!pendencia.privado,
        concluida: !!pendencia.concluida,
      });
    } else {
      setForm({
        atividade: "",
        tipo_atividade: "",
        data_prevista: "",
        responsavel_id: user?.id ?? "",
        privado: false,
        concluida: false,
      });
    }
  }, [pendencia, open, user?.id]);

  async function submit() {
    if (!form.atividade.trim()) {
      toast.error("Informe a atividade");
      return;
    }
    if (!user) return;
    setBusy(true);
    try {
      const payload = {
        atividade: form.atividade.trim(),
        tipo_atividade: form.tipo_atividade || null,
        data_prevista: form.data_prevista || null,
        responsavel_id: form.responsavel_id || null,
        privado: !!form.privado,
        concluida: !!form.concluida,
      };
      if (pendencia?.id) {
        const { error } = await supabase.from("pendencias").update(payload).eq("id", pendencia.id);
        if (error) throw error;
        toast.success("Pendência atualizada");
      } else {
        const { error } = await supabase
          .from("pendencias")
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success("Pendência criada");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pendencia ? "Editar pendência" : "Nova pendência"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Atividade *</Label>
            <Input
              value={form.atividade}
              onChange={(e) => setForm({ ...form, atividade: e.target.value })}
              placeholder="Descreva a atividade"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de atividade</Label>
              <Select
                value={form.tipo_atividade}
                onValueChange={(v) => setForm({ ...form, tipo_atividade: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data prevista</Label>
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => setForm({ ...form, data_prevista: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={form.responsavel_id || ""}
              onValueChange={(v) => setForm({ ...form, responsavel_id: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email || p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Privado</Label>
              <p className="text-xs text-muted-foreground">
                Visível somente para você (criador) e o responsável.
              </p>
            </div>
            <Switch
              checked={form.privado}
              onCheckedChange={(v) => setForm({ ...form, privado: v })}
            />
          </div>

          {pendencia && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>Concluída</Label>
              <Switch
                checked={form.concluida}
                onCheckedChange={(v) => setForm({ ...form, concluida: v })}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
