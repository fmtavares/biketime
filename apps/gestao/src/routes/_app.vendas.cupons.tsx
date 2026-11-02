import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/vendas/cupons")({
  component: CuponsPage,
});

type Situacao = "ativos" | "todos";

type EdicaoCupom = {
  id: string;
  codigo: string;
  tipo: "percentual" | "valor";
  valor: string;
  parceiroNome: string;
};

/**
 * Nome do parceiro ligado ao cupom. A compra não mostra esse nome.
 */
function nomeParceiroCupom(parceiros: unknown) {
  return (parceiros as { nome?: string } | null)?.nome ?? "Parceiro";
}

/** Texto curto do desconto, percentual ou reais. */
function textoDesconto(tipo: string, valor: number) {
  return tipo === "percentual" ? `${valor}%` : `R$ ${valor}`;
}

/** Data do banco (YYYY-MM-DD) em pt-BR. Vazio significa sem prazo. */
function textoData(valor: string | null) {
  if (!valor) return "Sem prazo";
  const [ano, mes, dia] = valor.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Aplica a busca e o filtro de situação numa lista já carregada.
 */
function combinaBusca(texto: string, busca: string) {
  const q = busca.trim().toLocaleLowerCase("pt-BR");
  if (!q) return true;
  return texto.toLocaleLowerCase("pt-BR").includes(q);
}

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
  const [editando, setEditando] = useState<EdicaoCupom | null>(null);
  const [dialogoParceiro, setDialogoParceiro] = useState(false);
  const [dialogoCupom, setDialogoCupom] = useState(false);
  const [buscaParceiro, setBuscaParceiro] = useState("");
  const [situacaoParceiro, setSituacaoParceiro] = useState<Situacao>("ativos");
  const [buscaCupom, setBuscaCupom] = useState("");
  const [situacaoCupom, setSituacaoCupom] = useState<Situacao>("ativos");
  const [filtroParceiroCupom, setFiltroParceiroCupom] = useState("");

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

  const parceirosVisiveis = useMemo(() => {
    return parceiros.filter((p) => {
      if (situacaoParceiro === "ativos" && !p.ativo) return false;
      return combinaBusca(p.nome, buscaParceiro);
    });
  }, [parceiros, situacaoParceiro, buscaParceiro]);

  const cuponsVisiveis = useMemo(() => {
    return cupons.filter((c) => {
      if (situacaoCupom === "ativos" && !c.ativo) return false;
      if (filtroParceiroCupom && c.parceiro_id !== filtroParceiroCupom) return false;
      const nome = nomeParceiroCupom(c.parceiros);
      return combinaBusca(`${c.codigo} ${nome}`, buscaCupom);
    });
  }, [cupons, situacaoCupom, filtroParceiroCupom, buscaCupom]);

  const cuponsPorParceiro = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of cupons) {
      mapa.set(c.parceiro_id, (mapa.get(c.parceiro_id) ?? 0) + 1);
    }
    return mapa;
  }, [cupons]);

  /** Inclui um parceiro pelo nome. O cupom é criado depois, apontando para ele. */
  async function criarParceiro() {
    const nome = nomeParceiro.trim();
    if (!nome) return toast.error("Informe o nome do parceiro.");
    setBusy(true);
    const { error } = await supabase.from("parceiros").insert({ nome });
    setBusy(false);
    if (error) return toast.error(error.message);
    setNomeParceiro("");
    setDialogoParceiro(false);
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
    setParceiroId("");
    setDialogoCupom(false);
    toast.success("Cupom criado");
    qc.invalidateQueries({ queryKey: ["cupons"] });
    qc.invalidateQueries({ queryKey: ["cupons-indicacoes"] });
  }

  /**
   * Abre a edição do código e do valor. O parceiro não entra no formulário.
   */
  function abrirEdicao(c: (typeof cupons)[number]) {
    setEditando({
      id: c.id,
      codigo: c.codigo,
      tipo: c.tipo === "valor" ? "valor" : "percentual",
      valor: String(c.valor),
      parceiroNome: nomeParceiroCupom(c.parceiros),
    });
  }

  /**
   * Grava código, tipo e valor. Não envia parceiro_id, então o vínculo permanece.
   * Pedidos já feitos guardam o código que valia na hora da compra.
   */
  async function salvarEdicao() {
    if (!editando) return;
    const cod = editando.codigo.trim();
    const n = Number(editando.valor.replace(",", "."));
    if (!cod || !Number.isFinite(n) || n <= 0) {
      return toast.error("Informe o código e um valor maior que zero.");
    }
    if (editando.tipo === "percentual" && n > 100) return toast.error("Percentual máximo é 100.");
    setBusy(true);
    const { error } = await supabase
      .from("cupons")
      .update({ codigo: cod, tipo: editando.tipo, valor: n })
      .eq("id", editando.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    setEditando(null);
    toast.success("Cupom atualizado");
    qc.invalidateQueries({ queryKey: ["cupons"] });
    qc.invalidateQueries({ queryKey: ["cupons-indicacoes"] });
  }

  /** Liga ou desliga parceiro ou cupom sem apagar o histórico dos pedidos. */
  async function alternar(tabela: "parceiros" | "cupons", id: string, ativo: boolean) {
    const { error } = await supabase.from(tabela).update({ ativo }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: [tabela] });
  }

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores.</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-display font-bold sm:text-2xl">Cupons e parceiros</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre o parceiro e ligue o cupom a ele. Na compra o cliente digita só o código.
        </p>
      </header>

      <Tabs defaultValue="parceiros">
        <TabsList>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="cupons">Cupons</TabsTrigger>
        </TabsList>

        <TabsContent value="parceiros" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={buscaParceiro}
              onChange={(e) => setBuscaParceiro(e.target.value)}
              placeholder="Buscar parceiro"
              className="max-w-xs"
            />
            <SelectSituacao value={situacaoParceiro} onChange={setSituacaoParceiro} />
            <Button type="button" className="ml-auto" onClick={() => setDialogoParceiro(true)}>
              Novo parceiro
            </Button>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cupons</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parceirosVisiveis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {parceiros.length === 0 ? "Nenhum parceiro ainda." : "Nenhum resultado na busca."}
                    </TableCell>
                  </TableRow>
                ) : (
                  parceirosVisiveis.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{cuponsPorParceiro.get(p.id) ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={p.ativo ? "secondary" : "outline"}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => alternar("parceiros", p.id, !p.ativo)}
                        >
                          {p.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="cupons" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={buscaCupom}
              onChange={(e) => setBuscaCupom(e.target.value)}
              placeholder="Buscar código ou parceiro"
              className="max-w-xs"
            />
            <select
              value={filtroParceiroCupom}
              onChange={(e) => setFiltroParceiroCupom(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              aria-label="Filtrar por parceiro"
            >
              <option value="">Todos os parceiros</option>
              {parceiros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                  {p.ativo ? "" : " (inativo)"}
                </option>
              ))}
            </select>
            <SelectSituacao value={situacaoCupom} onChange={setSituacaoCupom} />
            <Button type="button" className="ml-auto" onClick={() => setDialogoCupom(true)}>
              Novo cupom
            </Button>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuponsVisiveis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {cupons.length === 0 ? "Nenhum cupom ainda." : "Nenhum resultado na busca."}
                    </TableCell>
                  </TableRow>
                ) : (
                  cuponsVisiveis.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.codigo}</TableCell>
                      <TableCell>{textoDesconto(c.tipo, Number(c.valor))}</TableCell>
                      <TableCell>{nomeParceiroCupom(c.parceiros)}</TableCell>
                      <TableCell>{textoData(c.valido_ate)}</TableCell>
                      <TableCell>{c.limite_usos ?? "Sem limite"}</TableCell>
                      <TableCell>
                        <Badge variant={c.ativo ? "secondary" : "outline"}>
                          {c.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => abrirEdicao(c)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => alternar("cupons", c.id, !c.ativo)}
                        >
                          {c.ativo ? "Desativar" : "Ativar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogoParceiro} onOpenChange={setDialogoParceiro}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo parceiro</DialogTitle>
            <DialogDescription>Só o nome. O cupom é criado depois e aponta para ele.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void criarParceiro();
            }}
          >
            <Campo label="Nome">
              <Input
                value={nomeParceiro}
                onChange={(e) => setNomeParceiro(e.target.value)}
                placeholder="Nome de quem indica"
                autoFocus
              />
            </Campo>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogoParceiro(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoCupom} onOpenChange={setDialogoCupom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cupom</DialogTitle>
            <DialogDescription>O cliente digita só o código. O parceiro já fica ligado aqui.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void criarCupom();
            }}
          >
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogoCupom(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                Criar cupom
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cupom</DialogTitle>
            <DialogDescription>
              Parceiro: {editando?.parceiroNome}. Esse vínculo não muda. Pedidos já feitos continuam com o código da compra.
            </DialogDescription>
          </DialogHeader>
          {editando && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarEdicao();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Código">
                  <Input
                    value={editando.codigo}
                    onChange={(e) => setEditando({ ...editando, codigo: e.target.value })}
                  />
                </Campo>
                <Campo label="Tipo">
                  <select
                    value={editando.tipo}
                    onChange={(e) =>
                      setEditando({ ...editando, tipo: e.target.value as "percentual" | "valor" })
                    }
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="percentual">Percentual</option>
                    <option value="valor">Valor em R$</option>
                  </select>
                </Campo>
                <Campo label={editando.tipo === "percentual" ? "Percentual" : "Valor"}>
                  <Input
                    value={editando.valor}
                    onChange={(e) => setEditando({ ...editando, valor: e.target.value })}
                    inputMode="decimal"
                  />
                </Campo>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Combo Ativos / Todos usado nas duas abas. */
function SelectSituacao({ value, onChange }: { value: Situacao; onChange: (v: Situacao) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Situacao)}
      className="h-9 rounded-md border bg-background px-3 text-sm"
      aria-label="Situação"
    >
      <option value="ativos">Ativos</option>
      <option value="todos">Todos</option>
    </select>
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
