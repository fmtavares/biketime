import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, User, Trash2, Plus, Pencil, UserPlus, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const { isAdmin, loading, user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["users-roles"],
    queryFn: async () => {
      const [profs, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const rolesByUser: Record<string, string[]> = {};
      (roles.data ?? []).forEach((r) => {
        rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
      });
      return (profs.data ?? []).map((p) => ({ ...p, roles: rolesByUser[p.id] ?? [] }));
    },
    enabled: isAdmin,
  });

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const toggleRole = async (uid: string, role: "admin" | "vendedor" | "tecnico", has: boolean) => {
    setBusy(uid + role);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) toast.error(error.message);
      else toast.success("Papel removido");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) toast.error(error.message);
      else toast.success("Papel atribuído");
    }
    setBusy(null);
    refetch();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Usuários"
        description="Gerencie usuários, permissões e funcionários da equipe"
      />

      <UsersManager
        users={data ?? []}
        currentUserId={user?.id}
        busy={busy}
        onToggleRole={toggleRole}
        onChanged={refetch}
      />

      <FuncionariosManager isAdmin={isAdmin} />

      <div className="mt-6 rounded-xl border bg-secondary/40 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">Como funcionam os papéis</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Administrador</b> — pode excluir registros, gerenciar usuários e ver Relatórios.</li>
          <li><b>Vendas</b> — pode cadastrar clientes, bikes, abrir OS e atualizar status.</li>
          <li><b>Técnico</b> — pode executar e atualizar ordens de serviço na oficina.</li>
          <li>Novos usuários começam como Vendas automaticamente.</li>
        </ul>
      </div>
    </div>
  );
}

function FuncionariosManager({ isAdmin }: { isAdmin: boolean }) {
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: funcs, refetch } = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("funcionarios").select("*").order("nome");
      return data ?? [];
    },
  });

  const adicionar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    setBusy(true);
    const { error } = await (supabase.from as any)("funcionarios").insert({ nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Funcionário adicionado");
    setNovo("");
    refetch();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este funcionário?")) return;
    const { error } = await (supabase.from as any)("funcionarios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Funcionário removido");
    refetch();
  };

  return (
    <div className="mt-6 rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center gap-2">
        <Wrench className="size-4" />
        <h2 className="font-display font-bold">Funcionários da oficina</h2>
      </div>
      {isAdmin && (
        <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Nome do funcionário"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionar()}
          />
          <Button onClick={adicionar} disabled={busy}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      )}
      <ul className="divide-y">
        {funcs?.map((f: any) => (
          <li key={f.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span>{f.nome}</span>
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => remover(f.id)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </li>
        ))}
        {(funcs?.length ?? 0) === 0 && (
          <li className="px-5 py-6 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado.</li>
        )}
      </ul>
    </div>
  );
}

type UserRow = { id: string; full_name: string | null; email: string | null; created_at: string; roles: string[] };

function UsersManager({
  users,
  currentUserId,
  busy,
  onToggleRole,
  onChanged,
}: {
  users: UserRow[];
  currentUserId?: string;
  busy: string | null;
  onToggleRole: (uid: string, role: "admin" | "vendedor" | "tecnico", has: boolean) => void;
  onChanged: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const callAdmin = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    if (error) {
      // FunctionsHttpError: try to read the actual error body returned by the function
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) throw new Error(body.error);
        } catch (e) {
          if (e instanceof Error && e.message) throw e;
        }
      }
      throw new Error(error.message || "Erro ao chamar a função");
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data;
  };

  const remover = async (u: UserRow) => {
    if (!confirm(`Excluir o usuário ${u.full_name ?? u.email}? Esta ação é permanente.`)) return;
    try {
      await callAdmin({ action: "delete", user_id: u.id });
      toast.success("Usuário excluído");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir");
    }
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4" />
          <h2 className="font-display font-bold">Usuários e papéis</h2>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" /> Novo usuário
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3">Usuário</th>
              <th className="text-left px-5 py-3">E-mail</th>
              <th className="text-left px-5 py-3">Papéis</th>
              <th className="text-right px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdminUser = u.roles.includes("admin");
              const isVendedor = u.roles.includes("vendedor");
              const isTecnico = u.roles.includes("tecnico");
              const isSelf = u.id === currentUserId;
              const labelFor = (r: string) => (r === "vendedor" ? "vendas" : r);
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium">{u.full_name ?? "—"}</div>
                        {isSelf && (
                          <div className="text-[10px] text-accent-foreground bg-accent px-1.5 rounded inline-block">
                            você
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span
                          key={r}
                          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                            r === "admin" ? "bg-foreground text-background" : "bg-secondary"
                          }`}
                        >
                          {labelFor(r)}
                        </span>
                      ))}
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={isAdminUser ? "outline" : "default"}
                        disabled={busy === u.id + "admin" || (isSelf && isAdminUser)}
                        onClick={() => onToggleRole(u.id, "admin", isAdminUser)}
                      >
                        {isAdminUser ? "Remover admin" : "Tornar admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === u.id + "vendedor"}
                        onClick={() => onToggleRole(u.id, "vendedor", isVendedor)}
                      >
                        {isVendedor ? "Remover vendas" : "Tornar vendas"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === u.id + "tecnico"}
                        onClick={() => onToggleRole(u.id, "tecnico", isTecnico)}
                      >
                        {isTecnico ? "Remover técnico" : "Tornar técnico"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isSelf}
                        onClick={() => remover(u)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onChanged}
        callAdmin={callAdmin}
      />
      <EditUserDialog
        user={editUser}
        onOpenChange={(o) => !o && setEditUser(null)}
        onSaved={onChanged}
        callAdmin={callAdmin}
      />
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
  callAdmin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
  callAdmin: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"vendedor" | "admin" | "tecnico">("vendedor");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("vendedor");
  };

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error("Informe email e senha (mín. 6 caracteres)");
      return;
    }
    setBusy(true);
    try {
      await callAdmin({
        action: "create",
        email: email.trim(),
        password,
        full_name: fullName.trim() || email.trim(),
        role,
      });
      toast.success("Usuário criado");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar usuário");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Senha *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <select
              className="w-full border rounded-md h-9 px-2 bg-background text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "vendedor" | "admin" | "tecnico")}
            >
              <option value="vendedor">Vendas</option>
              <option value="tecnico">Técnico</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Criando…" : "Criar usuário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onOpenChange,
  onSaved,
  callAdmin,
}: {
  user: UserRow | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  callAdmin: (p: Record<string, unknown>) => Promise<unknown>;
}) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPassword("");
    }
  }, [user?.id]);

  const submit = async () => {
    if (!user) return;
    if (password && password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    setBusy(true);
    try {
      await callAdmin({
        action: "update",
        user_id: user.id,
        full_name: fullName.trim() || user.full_name,
        password: password.length >= 6 ? password : undefined,
      });
      toast.success("Usuário atualizado");
      setPassword("");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!user}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        {/* Honeypot to absorb browser/password-manager autofill */}
        <div style={{ position: "absolute", height: 0, width: 0, overflow: "hidden" }} aria-hidden>
          <input type="text" name="username" autoComplete="username" tabIndex={-1} readOnly />
          <input type="password" name="password" autoComplete="current-password" tabIndex={-1} readOnly />
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input
              id="edit-user-display-name"
              name="edit-user-display-name"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={user?.full_name ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ""} disabled autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha (deixe em branco para manter)</Label>
            <Input
              type="password"
              name="edit-user-new-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
