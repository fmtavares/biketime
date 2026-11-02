import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vendas/cupons")({
  component: CuponsPage,
});

/**
 * Cadastro de parceiros e dos cupons ligados a eles.
 * Na compra o cliente informa só o código; o parceiro já vem deste cadastro.
 */
function CuponsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [nomeParceiro, setNomeParceiro] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "valor">("percentual");
  const [valor, setValor] = useState("");
  const [validade, setValidade] = useState("");
  const [limite, setLimite] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: parceiros = [] } = useQuery({
    queryKey: ["parceiros"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parceiros").select("*").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cupons = [] } = useQuery({
    queryKey: ["cupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cupons")
        .select("*, parceiros(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  /** Inclui um parceiro pelo nome. O cupom é criado depois, apontando para ele. */
  async function criarParceiro() {
    const nome = nomeParceiro.trim();
    if (!nome) return;
    setBusy(true);
    const { error } = await supabase.from("parceiros").insert({ nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNomeParceiro("");
    toast.success("Parceiro cadastrado");
    qc.invalidateQueries({ queryKey: ["parceiros"] });
  }

  /**
   * Cria o cupom já vinculado ao parceiro escolhido.
   * Percentual não passa de 100. Limite vazio significa sem limite.
   */
  async function criarCupom() {
    const cod = codigo.trim();
    const n = Number(valor.replace(",", "."));
    if (!cod || !parceiroId || !Number.isFinite(n) || n <= 0) {
      return toast.error("Informe código, parceiro e valor.");
    }
    if (tipo === "percentual" && n > 100) return toast.error("Percentual máximo é 100.");
    setBusy(true);
    const { error } = await supabase.from("cupons").insert({
      codigo: cod,
      tipo,
      valor: n,
      parceiro_id: parceiroId,
      valido_ate: validade || null,
      limite_usos: limite.trim() ? Number(limite) : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCodigo("");
    setValor("");
    setValidade("");
    setLimite("");
    toast.success("Cupom criado");
    qc.invalidateQueries({ queryKey: ["cupons"] });
  }

  /** Liga ou desliga parceiro ou cupom sem apagar o histórico dos pedidos. */
  async function alternar(tabela: "parceiros" | "cupons", id: string, ativo: boolean) {
    const { error } = await supabase.from(tabela).update({ ativo }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [tabela] });
  }

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores.</p>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-display font-bold sm:text-2xl">Cupons e parceiros</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o parceiro e ligue o cupom a ele. Na compra o cliente digita só o código.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Parceiros</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            value={nomeParceiro}
            onChange={(e) => setNomeParceiro(e.target.value)}
            placeholder="Nome de quem indica"
            className="max-w-xs"
          />
          <Button type="button" disabled={busy} onClick={criarParceiro}>
            Adicionar
          </Button>
        </div>
        <ul className="space-y-1 text-sm">
          {parceiros.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className={p.ativo ? "" : "text-muted-foreground line-through"}>{p.nome}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => alternar("parceiros", p.id, !p.ativo)}
              >
                {p.ativo ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">Novo cupom</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Código">
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="BIKE10" />
          </Campo>
          <Campo label="Parceiro">
            <select
              value={parceiroId}
              onChange={(e) => setParceiroId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Selecione…</option>
              {parceiros
                .filter((p) => p.ativo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </Campo>
          <Campo label="Tipo">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "percentual" | "valor")}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="percentual">Percentual</option>
              <option value="valor">Valor em R$</option>
            </select>
          </Campo>
          <Campo label={tipo === "percentual" ? "Percentual" : "Valor"}>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" />
          </Campo>
          <Campo label="Válido até">
            <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
          </Campo>
          <Campo label="Limite de usos">
            <Input
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              placeholder="Vazio = sem limite"
              inputMode="numeric"
            />
          </Campo>
        </div>
        <Button type="button" disabled={busy} onClick={criarCupom}>
          Criar cupom
        </Button>
        <ul className="space-y-2 text-sm">
          {cupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className={c.ativo ? "" : "text-muted-foreground line-through"}>
                {c.codigo} · {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${c.valor}`} ·{" "}
                {(c.parceiros as { nome?: string } | null)?.nome ?? "Parceiro"}
              </span>
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => alternar("cupons", c.id, !c.ativo)}
              >
                {c.ativo ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Rótulo de um campo do formulário de cupom. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </label>
  );
}
