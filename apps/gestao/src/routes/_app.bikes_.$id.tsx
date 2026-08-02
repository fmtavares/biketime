import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Plus, Upload, Trash2, Bike as BikeIcon, QrCode } from "lucide-react";
import { BikeFormDialog } from "@/components/BikeFormDialog";
import { BikeAdesivoDialog } from "@/components/BikeAdesivoDialog";
import { urlQrBike } from "@/lib/bike-adesivo";
import { toast } from "sonner";

const TIPOS_FOTO = ["Geral", "Câmbio Dianteiro", "Câmbio Traseiro", "Suspensão", "Canote", "Guidão / Mesa"];
const TIPOS_HIST = ["Revisão", "Upgrade", "Troca de peça", "Garantia", "Acidente", "Lavagem técnica"];

export const Route = createFileRoute("/_app/bikes_/$id")({
  component: BikeDetail,
});

function BikeDetail() {
  const { id } = Route.useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [adesivoOpen, setAdesivoOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoUpload, setTipoUpload] = useState("Geral");

  const { data: bike, refetch } = useQuery({
    queryKey: ["bike", id],
    queryFn: async () => {
      const { data } = await supabase.from("bikes").select("*, clientes(id, nome)").eq("id", id).single();
      return data;
    },
  });

  const { data: fotos, refetch: refetchFotos } = useQuery({
    queryKey: ["bike-fotos", id],
    queryFn: async () => {
      const { data } = await supabase.from("bike_fotos").select("*").eq("bike_id", id).order("created_at");
      return data ?? [];
    },
  });

  const { data: historicos, refetch: refetchHist } = useQuery({
    queryKey: ["bike-hist", id],
    queryFn: async () => {
      const [{ data: manuais }, { data: oss }] = await Promise.all([
        supabase.from("historicos").select("*").eq("bike_id", id).order("data", { ascending: false }),
        supabase.from("ordens_servico").select("*").eq("bike_id", id),
      ]);
      const fromOS = (oss ?? []).map((o: any) => ({
        id: `os-${o.id}`,
        data: (o.data_conclusao ?? o.data_entrega ?? o.data_entrada ?? o.created_at)?.slice(0, 10),
        tipo: "Ordem de Serviço",
        descricao: [o.servicos_executados, o.problema_relatado].filter(Boolean).join(" — ") || "—",
        numero_os: o.numero,
        valor: (Number(o.valor_aprovado) || (Number(o.valor_pecas) + Number(o.valor_mao_obra))) || null,
        _status: o.status,
      }));
      const all = [...(manuais ?? []), ...fromOS];
      all.sort((a: any, b: any) => (b.data ?? "").localeCompare(a.data ?? ""));
      return all;
    },
  });

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    for (const file of files) {
      const path = `${id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("bike-fotos").upload(path, file);
      if (error) {
        toast.error(error.message);
        continue;
      }
      await supabase.from("bike_fotos").insert({ bike_id: id, tipo: tipoUpload, storage_path: path });
    }
    toast.success("Fotos enviadas");
    refetchFotos();
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFoto = async (foto: any) => {
    await supabase.storage.from("bike-fotos").remove([foto.storage_path]);
    await supabase.from("bike_fotos").delete().eq("id", foto.id);
    refetchFotos();
  };

  if (!bike) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <Link to="/bikes" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Bikes
      </Link>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <BikeIcon className="size-4" />
              <Link to="/clientes/$id" params={{ id: bike.clientes!.id }} className="hover:underline">
                {bike.clientes?.nome}
              </Link>
            </div>
            <h1 className="text-2xl font-display font-bold mt-1">{bike.marca} {bike.modelo}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {bike.codigo_bike && (
                <span className="font-mono font-semibold text-foreground">{bike.codigo_bike}</span>
              )}
              <span>{bike.ano}</span>
              <span>Tamanho {bike.tamanho ?? "—"}</span>
              <span>{bike.cor}</span>
              {bike.numero_serie && <span>SN: {bike.numero_serie}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!bike.codigo_bike) {
                  toast.error("Esta bike ainda não tem código de adesivo");
                  return;
                }
                setAdesivoOpen(true);
              }}
            >
              <QrCode className="size-4" /> Imprimir adesivo
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit className="size-4" /> Editar
            </Button>
          </div>
        </div>
        {bike.codigo_bike && (
          <p className="mt-3 text-xs text-muted-foreground">
            QR aponta para{" "}
            <span className="font-mono">{urlQrBike(bike.codigo_bike)}</span>
          </p>
        )}

        {bike.observacoes && (
          <div className="mt-4 p-3 rounded-lg bg-secondary text-sm">{bike.observacoes}</div>
        )}
      </div>

      <Tabs defaultValue="fotos" className="mt-6">
        <TabsList>
          <TabsTrigger value="fotos">Fotos</TabsTrigger>
          <TabsTrigger value="historico">Histórico técnico</TabsTrigger>
        </TabsList>

        <TabsContent value="fotos" className="mt-4">
          <div className="flex items-end gap-3 flex-wrap mb-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo da foto</Label>
              <Select value={tipoUpload} onValueChange={setTipoUpload}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_FOTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Enviar fotos
            </Button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotos?.map((f) => {
              const url = supabase.storage.from("bike-fotos").getPublicUrl(f.storage_path).data.publicUrl;
              return (
                <div key={f.id} className="rounded-lg border overflow-hidden group relative">
                  <img src={url} alt={f.tipo} className="aspect-square object-cover w-full" />
                  <div className="p-2 text-xs flex items-center justify-between">
                    <span>{f.tipo}</span>
                    <button onClick={() => removeFoto(f)} className="opacity-0 group-hover:opacity-100 text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {fotos?.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground border rounded-xl">
                Sem fotos ainda.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setHistOpen(true)}><Plus className="size-4" /> Novo registro</Button>
          </div>
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Data</th>
                  <th className="text-left px-4 py-2">Tipo</th>
                  <th className="text-left px-4 py-2">Descrição</th>
                  <th className="text-left px-4 py-2">OS</th>
                  <th className="text-right px-4 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {historicos?.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="px-4 py-2">{new Date(h.data).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2"><span className="px-2 py-0.5 text-xs rounded bg-accent/40">{h.tipo}</span></td>
                    <td className="px-4 py-2">{h.descricao}</td>
                    <td className="px-4 py-2 text-muted-foreground">{h.numero_os ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{h.valor ? `R$ ${Number(h.valor).toFixed(2)}` : "—"}</td>
                  </tr>
                ))}
                {historicos?.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sem registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <BikeFormDialog open={editOpen} onOpenChange={setEditOpen} bike={bike} onSaved={() => refetch()} />
      <HistoricoDialog open={histOpen} onOpenChange={setHistOpen} bikeId={id} onSaved={() => refetchHist()} />
      <BikeAdesivoDialog
        open={adesivoOpen}
        onOpenChange={setAdesivoOpen}
        bike={
          bike.codigo_bike
            ? {
                codigoBike: bike.codigo_bike,
                marca: bike.marca,
                modelo: bike.modelo,
                clienteNome: bike.clientes?.nome,
              }
            : null
        }
      />
    </div>
  );
}

function HistoricoDialog({
  open, onOpenChange, bikeId, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; bikeId: string; onSaved?: () => void }) {
  const [form, setForm] = useState<any>({
    data: new Date().toISOString().slice(0, 10),
    tipo: "Revisão", descricao: "", numero_os: "", km_horimetro: "", valor: "", observacoes: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.descricao) return toast.error("Descrição obrigatória");
    setBusy(true);
    const { error } = await supabase.from("historicos").insert({
      ...form,
      bike_id: bikeId,
      valor: form.valor ? Number(form.valor) : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Registro adicionado");
    setForm({ ...form, descricao: "", numero_os: "", km_horimetro: "", valor: "", observacoes: "" });
    onSaved?.();
    onOpenChange(false);
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo registro técnico</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Data</Label><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_HIST.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Descrição *</Label><Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Nº OS</Label><Input value={form.numero_os} onChange={(e) => set("numero_os", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Km/Horímetro</Label><Input value={form.km_horimetro} onChange={(e) => set("km_horimetro", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
