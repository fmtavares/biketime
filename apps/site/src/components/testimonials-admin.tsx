import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BUCKET = "event-photos";
const FOLDER = "testimonials";

type Testimonial = {
  id: string;
  name: string;
  role: string | null;
  photo_url: string;
  quote: string;
  display_order: number;
  is_active: boolean;
};

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export function TestimonialsAdmin({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [items, setItems] = useState<Testimonial[] | null>(null);
  const [editing, setEditing] = useState<Testimonial | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Testimonial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setItems(null);
    const { data, error } = await supabase
      .from("testimonials")
      .select("id, name, role, photo_url, quote, display_order, is_active")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar os depoimentos.");
      setItems([]);
      return;
    }
    setItems((data ?? []) as Testimonial[]);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const path = extractStoragePath(toDelete.photo_url);
      if (path) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove([path]);
        if (stErr) console.warn("Falha ao remover foto", stErr);
      }
      const { error } = await supabase.from("testimonials").delete().eq("id", toDelete.id);
      if (error) throw error;
      toast.success("Depoimento excluído.");
      setToDelete(null);
      load();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  if (creating || editing) {
    return (
      <TestimonialForm
        mode={editing ? "edit" : "create"}
        item={editing ?? undefined}
        onBack={() => {
          setCreating(false);
          setEditing(null);
        }}
        onLogout={onLogout}
        onDone={() => {
          setCreating(false);
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="container-px mx-auto max-w-6xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut size={14} /> Sair
        </Button>
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Depoimentos</p>
          <h1 className="text-2xl font-semibold text-foreground">Depoimentos cadastrados</h1>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} /> Novo depoimento
        </Button>
      </div>

      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <MessageSquareQuote className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum depoimento cadastrado ainda.</p>
          <Button onClick={() => setCreating(true)} className="mt-5">
            <Plus size={16} /> Cadastrar o primeiro
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-3 p-4">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {t.photo_url ? (
                    <img src={t.photo_url} alt={t.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                      {t.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-foreground">{t.name}</h3>
                    {!t.is_active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        oculto
                      </span>
                    )}
                  </div>
                  {t.role && <p className="truncate text-xs text-muted-foreground">{t.role}</p>}
                  <p className="text-[11px] text-muted-foreground">Ordem: {t.display_order}</p>
                </div>
              </div>
              <p className="line-clamp-3 px-4 pb-4 text-sm text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex gap-2 border-t border-border p-3">
                <Button size="sm" variant="outline" onClick={() => setEditing(t)} className="flex-1">
                  <Pencil size={14} /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setToDelete(t)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir depoimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `O depoimento de "${toDelete.name}" será removido permanentemente.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TestimonialForm({
  mode,
  item,
  onBack,
  onLogout,
  onDone,
}: {
  mode: "create" | "edit";
  item?: Testimonial;
  onBack: () => void;
  onLogout: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [role, setRole] = useState(item?.role ?? "");
  const [quote, setQuote] = useState(item?.quote ?? "");
  const [order, setOrder] = useState<number>(item?.display_order ?? 0);
  const [isActive, setIsActive] = useState(item?.is_active ?? true);
  const [existingPhoto, setExistingPhoto] = useState(item?.photo_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = filePreview ?? existingPhoto;

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    e.target.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quote.trim()) {
      toast.error("Preencha nome e depoimento.");
      return;
    }
    if (mode === "create" && !file) {
      toast.error("Selecione uma foto.");
      return;
    }
    setSaving(true);
    try {
      let photoUrl = existingPhoto;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${FOLDER}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        photoUrl = pub.publicUrl;

        if (mode === "edit" && item?.photo_url) {
          const old = extractStoragePath(item.photo_url);
          if (old) {
            const { error: rmErr } = await supabase.storage.from(BUCKET).remove([old]);
            if (rmErr) console.warn("Falha ao remover foto antiga", rmErr);
          }
        }
      }

      const payload = {
        name: name.trim(),
        role: role.trim() || null,
        quote: quote.trim(),
        display_order: Number.isFinite(order) ? order : 0,
        is_active: isActive,
        photo_url: photoUrl,
      };

      if (mode === "edit" && item) {
        const { error } = await supabase.from("testimonials").update(payload).eq("id", item.id);
        if (error) throw error;
        toast.success("Depoimento atualizado!");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("testimonials").insert({
          ...payload,
          created_by: userData.user?.id ?? null,
        });
        if (error) throw error;
        toast.success("Depoimento cadastrado!");
      }
      onDone();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-px mx-auto max-w-3xl py-10">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut size={14} /> Sair
        </Button>
      </div>

      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Depoimentos</p>
        <h1 className="text-2xl font-semibold text-foreground">
          {mode === "edit" ? "Editar depoimento" : "Novo depoimento"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Foto</label>
          <div className="flex items-center gap-5">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImagePlus size={22} />
                </div>
              )}
            </div>
            <label
              htmlFor="testimonial-photo"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              <Upload size={14} /> {previewUrl ? "Trocar foto" : "Selecionar foto"}
              <input
                id="testimonial-photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </label>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Cargo / contexto <span className="text-muted-foreground">(opcional)</span>
          </label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex.: Ciclista Road · Cliente desde 2020"
            maxLength={120}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Depoimento</label>
          <Textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={5}
            maxLength={600}
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Ordem de exibição</label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value, 10) || 0)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Menor número aparece primeiro.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Status</label>
            <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">{isActive ? "Ativo (visível no site)" : "Oculto"}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Upload size={16} /> {mode === "edit" ? "Salvar alterações" : "Salvar depoimento"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
