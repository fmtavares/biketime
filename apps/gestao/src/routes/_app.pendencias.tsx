import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, SearchBar } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Plus, Pencil, Trash2, CheckCircle2, Coins, Minus } from "lucide-react";
import { toast } from "sonner";
import { PendenciaFormDialog } from "@/components/PendenciaFormDialog";

export const Route = createFileRoute("/_app/pendencias")({
  component: PendenciasPage,
});

const COINS_BUDGET = 20;
const COINS_MAX_PER_ITEM = 3;

type Pendencia = {
  id: string;
  atividade: string;
  tipo_atividade: string | null;
  data_prevista: string | null;
  responsavel_id: string | null;
  privado: boolean;
  concluida: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Voto = { pendencia_id: string; user_id: string; coins: number };

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function PendenciasPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Pendencia[]>([]);
  const [votos, setVotos] = useState<Voto[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Pendencia | null>(null);
  const [toDelete, setToDelete] = useState<Pendencia | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: pend, error }, { data: vts }] = await Promise.all([
      supabase
        .from("pendencias")
        .select("*")
        .order("created_at", { ascending: false }),
      (supabase as any).from("pendencia_votos").select("pendencia_id, user_id, coins"),
    ]);
    if (error) toast.error(error.message);
    setItems((pend ?? []) as Pendencia[]);
    setVotos((vts ?? []) as Voto[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("profiles").select("id, full_name, email").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        map[p.id] = p.full_name || p.email || p.id.slice(0, 8);
      });
      setProfilesMap(map);
    });
  }, []);

  // total de moedas por pendência
  const totalCoins = useMemo(() => {
    const m: Record<string, number> = {};
    votos.forEach((v) => { m[v.pendencia_id] = (m[v.pendencia_id] ?? 0) + v.coins; });
    return m;
  }, [votos]);

  // moedas do usuário logado por pendência
  const myCoins = useMemo(() => {
    const m: Record<string, number> = {};
    votos.filter((v) => v.user_id === user?.id).forEach((v) => { m[v.pendencia_id] = v.coins; });
    return m;
  }, [votos, user?.id]);

  const myCoinsUsed = useMemo(
    () => Object.values(myCoins).reduce((a, b) => a + b, 0),
    [myCoins],
  );
  const myCoinsLeft = COINS_BUDGET - myCoinsUsed;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((p) => {
        if (!showDone && p.concluida) return false;
        if (onlyMine && p.responsavel_id !== user?.id) return false;
        if (!q) return true;
        return (
          p.atividade.toLowerCase().includes(q) ||
          (p.tipo_atividade ?? "").toLowerCase().includes(q) ||
          (profilesMap[p.responsavel_id ?? ""] ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // concluídas vão pro fim
        if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
        // mais moedas primeiro
        const dc = (totalCoins[b.id] ?? 0) - (totalCoins[a.id] ?? 0);
        if (dc !== 0) return dc;
        // depois data prevista (mais próxima primeiro)
        const da = a.data_prevista ?? "9999-12-31";
        const db = b.data_prevista ?? "9999-12-31";
        if (da !== db) return da < db ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [items, search, showDone, onlyMine, user?.id, profilesMap, totalCoins]);

  const concluidasMes = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return items
      .filter((p) => p.concluida && (p.updated_at ?? "").slice(0, 7) === ym)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [items]);

  async function toggleConcluida(p: Pendencia) {
    const { error } = await supabase
      .from("pendencias")
      .update({ concluida: !p.concluida })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const { error } = await supabase.from("pendencias").delete().eq("id", toDelete.id);
    if (error) toast.error(error.message);
    else toast.success("Pendência excluída");
    setToDelete(null);
    load();
  }

  async function adjustCoins(p: Pendencia, delta: number) {
    if (!user) return;
    const current = myCoins[p.id] ?? 0;
    const next = current + delta;
    if (next < 0 || next > COINS_MAX_PER_ITEM) return;
    if (delta > 0 && myCoinsLeft < delta) {
      toast.error(`Sem moedas disponíveis (${myCoinsLeft}/${COINS_BUDGET}).`);
      return;
    }
    const client = supabase as any;
    let error;
    if (next === 0) {
      ({ error } = await client
        .from("pendencia_votos")
        .delete()
        .eq("pendencia_id", p.id)
        .eq("user_id", user.id));
    } else {
      ({ error } = await client
        .from("pendencia_votos")
        .upsert(
          { pendencia_id: p.id, user_id: user.id, coins: next },
          { onConflict: "pendencia_id,user_id" },
        ));
    }
    if (error) return toast.error(error.message);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Pendências"
        description="Controle de atividades, pendências e melhorias."
        action={
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            <Plus className="size-4" /> Nova pendência
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar atividade, tipo ou responsável…" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="show-done" checked={showDone} onCheckedChange={setShowDone} />
          <Label htmlFor="show-done" className="cursor-pointer">Mostrar concluídas</Label>
        </div>
        <Button
          variant={onlyMine ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyMine((v) => !v)}
        >
          {onlyMine ? "Mostrando minhas" : "Apenas minhas"}
        </Button>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <Coins className="size-3.5 text-amber-500" />
          {myCoinsLeft} / {COINS_BUDGET} moedas disponíveis
        </Badge>
      </div>

      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Prioridade</TableHead>
              <TableHead>Atividade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data prevista</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma pendência.</TableCell></TableRow>
            ) : filtered.map((p) => {
              const atrasada = !p.concluida && p.data_prevista && p.data_prevista < today;
              const canManage = p.responsavel_id
                ? p.responsavel_id === user?.id
                : p.created_by === user?.id;
              const mine = myCoins[p.id] ?? 0;
              const total = totalCoins[p.id] ?? 0;
              const canVote = !p.concluida && (!p.privado || p.created_by === user?.id);
              return (
                <TableRow key={p.id} className={p.concluida ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={!canVote || mine === 0}
                        onClick={() => adjustCoins(p, -1)}
                        title="Remover moeda"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <div className="flex flex-col items-center min-w-[44px]">
                        <div className="flex items-center gap-1 font-medium text-sm">
                          <Coins className="size-3.5 text-amber-500" />
                          {total}
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                          suas: {mine}/{COINS_MAX_PER_ITEM}
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        disabled={!canVote || mine >= COINS_MAX_PER_ITEM || myCoinsLeft <= 0}
                        onClick={() => adjustCoins(p, 1)}
                        title="Adicionar moeda"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.privado && <Lock className="size-3.5 text-muted-foreground" />}
                      <span className={p.concluida ? "line-through" : ""}>{p.atividade}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.tipo_atividade ?? "—"}</TableCell>
                  <TableCell>
                    <span className={atrasada ? "text-destructive font-medium" : ""}>
                      {fmtDate(p.data_prevista)}
                    </span>
                  </TableCell>
                  <TableCell>{profilesMap[p.responsavel_id ?? ""] ?? "—"}</TableCell>
                  <TableCell>
                    {p.concluida ? (
                      <Badge variant="secondary">Concluída</Badge>
                    ) : atrasada ? (
                      <Badge variant="destructive">Atrasada</Badge>
                    ) : (
                      <Badge>Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!canManage}
                        onClick={() => canManage && toggleConcluida(p)}
                        title={canManage ? (p.concluida ? "Reabrir" : "Concluir") : "Somente o responsável pode alterar"}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!canManage}
                        onClick={() => { if (canManage) { setEditing(p); setOpenForm(true); } }}
                        title={canManage ? "Editar" : "Somente o responsável pode editar"}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!canManage}
                        onClick={() => canManage && setToDelete(p)}
                        title={canManage ? "Excluir" : "Somente o responsável pode excluir"}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">
          Concluídas no mês{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({concluidasMes.length})
          </span>
        </h2>
        <div className="border rounded-md overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atividade</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data prevista</TableHead>
                <TableHead>Concluída em</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concluidasMes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma atividade concluída neste mês.
                  </TableCell>
                </TableRow>
              ) : concluidasMes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.privado && <Lock className="size-3.5 text-muted-foreground" />}
                      <span>{p.atividade}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p.tipo_atividade ?? "—"}</TableCell>
                  <TableCell>{fmtDate(p.data_prevista)}</TableCell>
                  <TableCell>{fmtDate(p.updated_at.slice(0, 10))}</TableCell>
                  <TableCell>{profilesMap[p.responsavel_id ?? ""] ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <PendenciaFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        pendencia={editing}
        onSaved={load}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pendência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
