import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import {
  ArrowLeft,
  Calendar,
  ImagePlus,
  List,
  Loader2,
  Lock,
  LogOut,
  MessageSquareQuote,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminContext } from "@/lib/admin.functions";
import { TestimonialsAdmin } from "@/components/testimonials-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · BikeTime" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Status = "checking" | "login" | "ready" | "denied";
type View = "dashboard" | "new-event" | "list-events" | "edit-event" | "testimonials";

type PastEvent = {
  id: string;
  name: string;
  event_date: string;
  description: string;
  photos: string[];
};

const BUCKET = "event-photos";

function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

function AdminPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [editing, setEditing] = useState<PastEvent | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const getCtx = useServerFn(getAdminContext);
  const runIdRef = useRef(0);

  const verify = async () => {
    const myRun = ++runIdRef.current;
    setStatus("checking");
    setErrorMsg(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        if (runIdRef.current === myRun) setStatus("login");
        return;
      }
      const ctx = await getCtx();
      if (runIdRef.current !== myRun) return;
      if (ctx.isAdmin) {
        setStatus("ready");
      } else {
        await supabase.auth.signOut();
        setStatus("denied");
      }
    } catch (e) {
      console.error("[admin] verify failed", e);
      if (runIdRef.current !== myRun) return;
      setErrorMsg("Não foi possível verificar suas permissões. Tente novamente.");
      setStatus("login");
    }
  };

  useEffect(() => {
    verify();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        runIdRef.current++;
        setStatus("login");
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        verify();
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setSubmitting(false);
      console.error("[admin] login failed", error);
      toast.error("Credenciais inválidas");
      return;
    }
    await verify();
    setSubmitting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPassword("");
    setView("dashboard");
    setEditing(null);
  };

  const goDashboard = () => {
    setEditing(null);
    setView("dashboard");
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "ready") {
    if (view === "new-event") {
      return (
        <EventForm
          mode="create"
          onDone={() => setView("list-events")}
          onBack={goDashboard}
          onLogout={handleLogout}
        />
      );
    }
    if (view === "list-events") {
      return (
        <EventsList
          onBack={goDashboard}
          onLogout={handleLogout}
          onNew={() => setView("new-event")}
          onEdit={(ev) => {
            setEditing(ev);
            setView("edit-event");
          }}
        />
      );
    }
    if (view === "edit-event" && editing) {
      return (
        <EventForm
          mode="edit"
          event={editing}
          onDone={() => {
            setEditing(null);
            setView("list-events");
          }}
          onBack={() => {
            setEditing(null);
            setView("list-events");
          }}
          onLogout={handleLogout}
        />
      );
    }
    if (view === "testimonials") {
      return <TestimonialsAdmin onBack={goDashboard} onLogout={handleLogout} />;
    }
    return (
      <AdminDashboard
        onLogout={handleLogout}
        onNewEvent={() => setView("new-event")}
        onListEvents={() => setView("list-events")}
        onManageTestimonials={() => setView("testimonials")}
      />
    );
  }

  return (
    <div className="container-px mx-auto flex min-h-[80vh] max-w-md items-center">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Lock size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Área restrita</h1>
            <p className="text-sm text-muted-foreground">Acesso apenas para administradores</p>
          </div>
        </div>

        {status === "denied" && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Esse usuário não tem permissão de administrador.
          </p>
        )}

        {errorMsg && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({
  onLogout,
  onNewEvent,
  onListEvents,
  onManageTestimonials,
}: {
  onLogout: () => void;
  onNewEvent: () => void;
  onListEvents: () => void;
  onManageTestimonials: () => void;
}) {
  return (
    <div className="container-px mx-auto max-w-6xl py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Painel</p>
          <h1 className="text-2xl font-semibold text-foreground">Acessos rápidos</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut size={14} /> Sair
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Calendar size={14} /> Eventos
          </div>
          <h2 className="font-display text-2xl font-bold">Cadastrar evento realizado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Registre um evento que já aconteceu com nome, data, descrição e fotos.
          </p>
          <Button size="lg" onClick={onNewEvent} className="mt-5">
            <Plus size={18} /> Novo evento
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <List size={14} /> Gerenciar
          </div>
          <h2 className="font-display text-2xl font-bold">Ver eventos cadastrados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Edite ou exclua os eventos já registrados na página de Eventos.
          </p>
          <Button size="lg" variant="outline" onClick={onListEvents} className="mt-5">
            <List size={18} /> Abrir lista
          </Button>
        </div>

        <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/30 via-card to-card p-8 md:col-span-2">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <MessageSquareQuote size={14} /> Depoimentos
          </div>
          <h2 className="font-display text-2xl font-bold">Gerenciar depoimentos</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre, edite ou remova os depoimentos exibidos no carrossel da página inicial.
          </p>
          <Button size="lg" onClick={onManageTestimonials} className="mt-5">
            <MessageSquareQuote size={18} /> Abrir depoimentos
          </Button>
        </div>
      </div>
    </div>
  );
}

function EventsList({
  onBack,
  onLogout,
  onNew,
  onEdit,
}: {
  onBack: () => void;
  onLogout: () => void;
  onNew: () => void;
  onEdit: (ev: PastEvent) => void;
}) {
  const [events, setEvents] = useState<PastEvent[] | null>(null);
  const [toDelete, setToDelete] = useState<PastEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setEvents(null);
    const { data, error } = await supabase
      .from("past_events")
      .select("id, name, event_date, description, photos")
      .order("event_date", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Não foi possível carregar os eventos.");
      setEvents([]);
      return;
    }
    setEvents((data ?? []) as PastEvent[]);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const paths = toDelete.photos
        .map(extractStoragePath)
        .filter((p): p is string => !!p);
      if (paths.length > 0) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (stErr) console.warn("Falha ao remover algumas fotos", stErr);
      }
      const { error } = await supabase.from("past_events").delete().eq("id", toDelete.id);
      if (error) throw error;
      toast.success("Evento excluído.");
      setToDelete(null);
      load();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir o evento.");
    } finally {
      setDeleting(false);
    }
  };

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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Eventos</p>
          <h1 className="text-2xl font-semibold text-foreground">Eventos cadastrados</h1>
        </div>
        <Button onClick={onNew}>
          <Plus size={16} /> Novo evento
        </Button>
      </div>

      {events === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum evento cadastrado ainda.</p>
          <Button onClick={onNew} className="mt-5">
            <Plus size={16} /> Cadastrar o primeiro
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative aspect-[4/3] bg-muted">
                {ev.photos[0] ? (
                  <img
                    src={ev.photos[0]}
                    alt={ev.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Calendar size={32} />
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-foreground backdrop-blur">
                  {new Date(ev.event_date + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-foreground">{ev.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{ev.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {ev.photos.length} foto{ev.photos.length === 1 ? "" : "s"}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEdit(ev)} className="flex-1">
                    <Pencil size={14} /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setToDelete(ev)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" e ${toDelete.photos.length} foto(s) serão removidos permanentemente.`
                : ""}
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

function EventForm({
  mode,
  event,
  onDone,
  onBack,
  onLogout,
}: {
  mode: "create" | "edit";
  event?: PastEvent;
  onDone: () => void;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(event?.name ?? "");
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [existingPhotos, setExistingPhotos] = useState<string[]>(event?.photos ?? []);
  const [removedPhotos, setRemovedPhotos] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...list]);
    e.target.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExisting = (url: string) => {
    setExistingPhotos((prev) => prev.filter((u) => u !== url));
    setRemovedPhotos((prev) => [...prev, url]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !eventDate || !description.trim()) {
      toast.error("Preencha nome, data e descrição.");
      return;
    }
    setSaving(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${eventDate}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }

      const photos = [...existingPhotos, ...newUrls];

      if (mode === "edit" && event) {
        const { error: updErr } = await supabase
          .from("past_events")
          .update({
            name: name.trim(),
            event_date: eventDate,
            description: description.trim(),
            photos,
          })
          .eq("id", event.id);
        if (updErr) throw updErr;

        const paths = removedPhotos
          .map(extractStoragePath)
          .filter((p): p is string => !!p);
        if (paths.length > 0) {
          const { error: stErr } = await supabase.storage.from(BUCKET).remove(paths);
          if (stErr) console.warn("Falha ao remover fotos antigas", stErr);
        }

        toast.success("Evento atualizado!");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error: insErr } = await supabase.from("past_events").insert({
          name: name.trim(),
          event_date: eventDate,
          description: description.trim(),
          photos,
          created_by: userData.user?.id ?? null,
        });
        if (insErr) throw insErr;
        toast.success("Evento cadastrado com sucesso!");
      }

      onDone();
    } catch (err) {
      console.error(err);
      toast.error(
        mode === "edit"
          ? "Não foi possível atualizar o evento."
          : "Não foi possível salvar o evento."
      );
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
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Eventos</p>
        <h1 className="text-2xl font-semibold text-foreground">
          {mode === "edit" ? "Editar evento" : "Novo evento realizado"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Nome do evento</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Pedal Noturno Perdizes"
            maxLength={120}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Data do evento</label>
          <Input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Descrição</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Conte como foi o evento, quem participou, momentos marcantes..."
            rows={5}
            maxLength={2000}
            required
          />
        </div>

        {existingPhotos.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Fotos atuais</label>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {existingPhotos.map((url) => (
                <li
                  key={url}
                  className="group relative overflow-hidden rounded-lg border border-border bg-background"
                >
                  <img src={url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  <button
                    type="button"
                    onClick={() => removeExisting(url)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1.5 text-destructive opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    aria-label="Remover foto"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            {existingPhotos.length > 0 ? "Adicionar novas fotos" : "Fotos"}
          </label>
          <label
            htmlFor="photos"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 px-6 py-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/30"
          >
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Clique para selecionar imagens</span>
            <span className="text-xs text-muted-foreground">PNG, JPG ou WEBP — várias fotos permitidas</span>
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
          </label>

          {files.length > 0 && (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((file, idx) => {
                const url = URL.createObjectURL(file);
                return (
                  <li
                    key={`${file.name}-${idx}`}
                    className="group relative overflow-hidden rounded-lg border border-border bg-background"
                  >
                    <img
                      src={url}
                      alt={file.name}
                      className="aspect-square w-full object-cover"
                      onLoad={() => URL.revokeObjectURL(url)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1.5 text-destructive opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                      aria-label="Remover foto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
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
                <Upload size={16} /> {mode === "edit" ? "Salvar alterações" : "Salvar evento"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
