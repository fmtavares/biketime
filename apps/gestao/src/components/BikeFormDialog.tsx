import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CurrencyInput({ value, onChange }: { value: string | number; onChange: (v: string) => void }) {
  const num = typeof value === "number" ? value : value === "" ? null : Number(value);
  const display = num == null || isNaN(num) || num === 0 ? "" : brl(num);
  return (
    <Input
      inputMode="numeric"
      placeholder="R$ 0,00"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) return onChange("");
        onChange(String(Number(digits) / 100));
      }}
    />
  );
}

export function BikeFormDialog({
  open,
  onOpenChange,
  clienteId,
  bike,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId?: string;
  bike?: any;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<any>({
    cliente_id: clienteId,
    marca: "", modelo: "", ano: "", cor: "", tamanho: "",
    tipo: "", grupo: "", rodas: "",
    numero_serie: "", data_compra: "", valor_pago: "",
    onde_comprou: "", bike_atual: true, status: "atual", observacoes: "",
  });
  const [busy, setBusy] = useState(false);

  // Cliente search (when no clienteId)
  const [clientes, setClientes] = useState<any[]>([]);
  const [marcas, setMarcas] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    if (!clienteId && open) {
      supabase.from("clientes").select("id, nome").order("nome").then(({ data }) => setClientes(data ?? []));
    }
    if (open) {
      supabase.from("marcas_bikes").select("id, nome").order("nome").then(({ data }) => setMarcas(data ?? []));
    }
  }, [clienteId, open]);

  useEffect(() => {
    if (bike) {
      setForm({ ...bike, ano: bike.ano ?? "", valor_pago: bike.valor_pago ?? "" });
    } else if (clienteId) {
      setForm((f: any) => ({ ...f, cliente_id: clienteId }));
    }
  }, [bike, clienteId]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.cliente_id) return toast.error("Selecione o cliente");
    if (!form.marca || !form.modelo) return toast.error("Marca e modelo são obrigatórios");
    setBusy(true);
    const { clientes, id: _id, created_at, updated_at, ...rest } = form;
    const payload = {
      ...rest,
      ano: form.ano ? Number(form.ano) : null,
      valor_pago: form.valor_pago ? Number(form.valor_pago) : null,
      data_compra: form.data_compra || null,
    };
    const { error } = bike
      ? await supabase.from("bikes").update(payload).eq("id", bike.id)
      : await supabase.from("bikes").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(bike ? "Bike atualizada" : "Bike criada");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bike ? "Editar bike" : "Nova bike"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!clienteId && (
            <Field label="Cliente *">
              <Select value={form.cliente_id ?? ""} onValueChange={(v) => set("cliente_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Marca *">
              <Select value={form.marca || ""} onValueChange={(v) => set("marca", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                <SelectContent>
                  {marcas.map((m) => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modelo *"><Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} /></Field>
            <Field label="Tipo">
              <Select value={form.tipo || ""} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {["MTB","Speed/Road","Gravel","Urbana","BMX","Infantil","Dobrável","E-Bike","Triathlon","Downhill"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Grupo"><Input value={form.grupo ?? ""} onChange={(e) => set("grupo", e.target.value)} placeholder="Ex: Shimano XT, SRAM GX…" /></Field>
            <Field label="Rodas"><Input value={form.rodas ?? ""} onChange={(e) => set("rodas", e.target.value)} placeholder="Ex: 29, 700c, DT Swiss…" /></Field>
            <Field label="Ano"><Input type="number" value={form.ano} onChange={(e) => set("ano", e.target.value)} /></Field>
            <Field label="Cor"><Input value={form.cor} onChange={(e) => set("cor", e.target.value)} /></Field>
            <Field label="Tamanho"><Input value={form.tamanho} onChange={(e) => set("tamanho", e.target.value)} /></Field>
            <Field label="Número de série"><Input value={form.numero_serie} onChange={(e) => set("numero_serie", e.target.value)} /></Field>
            <Field label="Data da compra"><Input type="date" value={form.data_compra ?? ""} onChange={(e) => set("data_compra", e.target.value)} /></Field>
            <Field label="Valor pago"><CurrencyInput value={form.valor_pago} onChange={(v) => set("valor_pago", v)} /></Field>
            <Field label="Onde comprou"><Input value={form.onde_comprou} onChange={(e) => set("onde_comprou", e.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atual">Atual</SelectItem>
                  <SelectItem value="vendida">Vendida</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.bike_atual} onCheckedChange={(v) => set("bike_atual", v)} id="atual" />
            <Label htmlFor="atual">Bike atual do cliente</Label>
          </div>

          <Field label="Observações">
            <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} placeholder="Detalhes técnicos, avarias, customizações…" />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
