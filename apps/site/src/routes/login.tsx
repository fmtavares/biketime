import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  clienteVinculado,
  entrarComPasskey,
  msgErroPasskey,
} from "@/lib/passkey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — BikeTime" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginClientePage,
});

/**
 * Login do portal do cliente: e-mail + senha e/ou biometria (passkey / Face ID).
 * Contas são criadas apenas no Gestão.
 */
function LoginClientePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyPasskey, setBusyPasskey] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) return;
      const ok = await clienteVinculado(data.session.user.id);
      if (ok) navigate({ to: "/minha-conta" });
    });
  }, [navigate]);

  /**
   * Após login Auth, valida vínculo com `clientes` e redireciona ou bloqueia.
   */
  async function concluirAcesso(userId: string) {
    const ok = await clienteVinculado(userId);
    if (!ok) {
      const { data: staff } = await (supabase as any).rpc("is_staff", {
        _user_id: userId,
      });
      await supabase.auth.signOut();
      if (staff === true) {
        setAviso(
          "Este e-mail é da equipe e ainda não está vinculado a um cadastro de cliente no Gestão (Acesso ao site).",
        );
      } else {
        setAviso(
          "Cadastro não encontrado. Fale com a Bike Time na loja para liberar seu acesso.",
        );
      }
      return false;
    }
    navigate({ to: "/minha-conta" });
    return true;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setAviso(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        toast.error("E-mail ou senha inválidos");
        return;
      }
      const uid = data.user?.id;
      if (!uid) {
        toast.error("Não foi possível entrar");
        return;
      }
      await concluirAcesso(uid);
    } finally {
      setBusy(false);
    }
  };

  /** Login com Face ID / biometria do dispositivo (passkey). */
  async function handlePasskey() {
    setBusyPasskey(true);
    setAviso(null);
    try {
      const { data, error } = await entrarComPasskey();
      if (error) {
        toast.error(msgErroPasskey(error));
        return;
      }
      const uid = data.user?.id;
      if (!uid) {
        toast.error("Não foi possível entrar com biometria");
        return;
      }
      await concluirAcesso(uid);
    } catch (err) {
      toast.error(msgErroPasskey(err as { message?: string }));
    } finally {
      setBusyPasskey(false);
    }
  }

  const ocupado = busy || busyPasskey;

  return (
    <div className="portal-shell">
      <div className="container-px mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <Lock className="size-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold">Área do cliente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com e-mail e senha ou com Face ID / biometria do aparelho.
          </p>
        </div>

        <form onSubmit={handleLogin} className="portal-panel space-y-4 rounded-2xl border p-6">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {aviso && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground">
              {aviso}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={ocupado}>
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Entrando…
              </>
            ) : (
              "Entrar"
            )}
          </Button>

          <div className="relative py-1 text-center text-xs text-muted-foreground">
            <span className="bg-card px-2">ou</span>
            <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border/60" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={ocupado}
            onClick={handlePasskey}
          >
            {busyPasskey ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Abrindo biometria…
              </>
            ) : (
              <>
                <Fingerprint className="mr-2 size-4" /> Entrar com Face ID / biometria
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ainda não tem acesso?{" "}
          <Link to="/contato" className="underline underline-offset-2 hover:text-foreground">
            Fale com a loja
          </Link>
          . Para ativar a biometria, entre com senha e cadastre em Minha conta.
        </p>
      </div>
    </div>
  );
}
