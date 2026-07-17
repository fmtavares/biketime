import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike } from "lucide-react";
import bikeTimeLogo from "@/assets/biketime-logo.png";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-background relative overflow-hidden">
        <div className="flex items-center gap-3">
          <img src={bikeTimeLogo} alt="Bike Time" className="size-12 rounded-full object-cover" />
          <div>
            <div className="font-display font-bold text-lg">Bike Time</div>
            <div className="text-xs uppercase tracking-widest opacity-60">CRM + Oficina</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Sua oficina,<br />
            <span className="text-accent">organizada de ponta a ponta.</span>
          </h1>
          <p className="mt-6 text-sm opacity-70 max-w-md">
            Clientes, bikes, histórico técnico e Kanban da oficina em uma plataforma simples e rápida.
          </p>
        </div>
        <div className="absolute -right-32 -bottom-32 size-[400px] rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="flex justify-center lg:hidden mb-8">
            <img src={bikeTimeLogo} alt="Bike Time" className="size-24 rounded-full object-cover" />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </Button>



        </form>
      </div>
    </div>
  );
}
