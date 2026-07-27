import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bike,
  ClipboardList,
  Loader2,
  Pencil,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatPhoneBr } from "@/lib/utils";

const STATUS_OS: Record<string, string> = {
  fila: "Fila de entrada",
  avaliacao: "Avaliação",
  aguardando_aprovacao: "Aguardando aprovação",
  em_execucao: "Em execução",
  com_problemas: "Com problemas",
  finalizada: "Finalizada",
  entregue: "Entregue",
  pago: "Pago",
};

export const Route = createFileRoute("/minha-conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — BikeTime" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MinhaContaPage,
});

type ClienteCadastro = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  telefone_secundario: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  apto: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  instagram: string | null;
};

/** Campos que o cliente pode editar no portal (nunca email/cpf/vip/origem/obs/user_id). */
type FormEditavel = {
  nome: string;
  whatsapp: string;
  telefone_secundario: string;
  data_nascimento: string;
  cep: string;
  endereco: string;
  numero: string;
  apto: string;
  bairro: string;
  cidade: string;
  estado: string;
  instagram: string;
};

type PainelAtivo = "dados" | "bikes" | "os";

type BikeCliente = {
  id: string;
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  cor: string | null;
  tamanho: string | null;
  tipo: string | null;
  numero_serie: string | null;
  bike_atual: boolean | null;
  status: string | null;
};

type OsCliente = {
  id: string;
  numero: string;
  status: string;
  data_prevista: string | null;
  proxima_revisao: string | null;
  problema_relatado: string | null;
  valor_mao_obra: number | null;
  valor_pecas: number | null;
  valor_aprovado: number | null;
  created_at: string;
  bike_id: string | null;
  bikes: { marca: string | null; modelo: string | null } | null;
};

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

/**
 * Monta o formulário editável a partir do cadastro carregado.
 */
function formFromCliente(c: ClienteCadastro): FormEditavel {
  return {
    nome: c.nome ?? "",
    whatsapp: formatPhoneBr(c.whatsapp ?? ""),
    telefone_secundario: formatPhoneBr(c.telefone_secundario ?? ""),
    data_nascimento: c.data_nascimento ?? "",
    cep: c.cep ?? "",
    endereco: c.endereco ?? "",
    numero: c.numero ?? "",
    apto: c.apto ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    estado: c.estado ?? "",
    instagram: c.instagram ?? "",
  };
}

/**
 * Área logada do cliente — mesma diagramação de espaço das demais páginas do site.
 */
function MinhaContaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteCadastro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<PainelAtivo>("dados");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<FormEditavel | null>(null);
  const [saving, setSaving] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [bikes, setBikes] = useState<BikeCliente[]>([]);
  const [ordens, setOrdens] = useState<OsCliente[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function carregar() {
      setLoading(true);
      setErro(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        if (!cancelled) navigate({ to: "/login" });
        return;
      }

      const { data, error } = await (supabase as any)
        .from("clientes")
        .select(
          "id, nome, email, whatsapp, telefone_secundario, cpf, data_nascimento, cep, endereco, numero, apto, bairro, cidade, estado, instagram",
        )
        .eq("user_id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        await supabase.auth.signOut();
        setErro("Cadastro não encontrado. Fale com a Bike Time.");
        setCliente(null);
        setLoading(false);
        return;
      }

      const c = data as ClienteCadastro;
      setCliente(c);
      setForm(formFromCliente(c));
      setLoading(false);

      // Bikes e OS do próprio cliente
      setLoadingListas(true);
      const [bikesRes, osRes] = await Promise.all([
        (supabase as any)
          .from("bikes")
          .select(
            "id, marca, modelo, ano, cor, tamanho, tipo, numero_serie, bike_atual, status",
          )
          .eq("cliente_id", c.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("ordens_servico")
          .select(
            "id, numero, status, data_prevista, proxima_revisao, problema_relatado, valor_mao_obra, valor_pecas, valor_aprovado, created_at, bike_id, bikes(marca, modelo)",
          )
          .eq("cliente_id", c.id)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setBikes((bikesRes.data as BikeCliente[]) ?? []);
      setOrdens((osRes.data as OsCliente[]) ?? []);
      setLoadingListas(false);
    }

    carregar();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const set = (k: keyof FormEditavel, v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  /**
   * Busca endereço pelo CEP (ViaCEP).
   */
  async function buscarCep(raw: string) {
    const cep = (raw || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setForm((f) =>
        f
          ? {
              ...f,
              endereco: data.logradouro ?? f.endereco,
              bairro: data.bairro ?? f.bairro,
              cidade: data.localidade ?? f.cidade,
              estado: data.uf ?? f.estado,
            }
          : f,
      );
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setBuscandoCep(false);
    }
  }

  /**
   * Salva apenas campos cadastrais permitidos (nunca email/cpf/vip/origem/obs/user_id).
   */
  async function salvarDados() {
    if (!cliente || !form) return;
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim() || null,
      telefone_secundario: form.telefone_secundario.trim() || null,
      data_nascimento: form.data_nascimento || null,
      cep: form.cep.trim() || null,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      apto: form.apto.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      instagram: form.instagram.trim() || null,
    };
    const { data, error } = await (supabase as any)
      .from("clientes")
      .update(payload)
      .eq("id", cliente.id)
      .select(
        "id, nome, email, whatsapp, telefone_secundario, cpf, data_nascimento, cep, endereco, numero, apto, bairro, cidade, estado, instagram",
      )
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message || "Não foi possível salvar");
      return;
    }
    const atualizado = data as ClienteCadastro;
    setCliente(atualizado);
    setForm(formFromCliente(atualizado));
    setEditando(false);
    toast.success("Dados atualizados");
  }

  const cancelarEdicao = () => {
    if (cliente) setForm(formFromCliente(cliente));
    setEditando(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (erro || !cliente || !form) {
    return (
      <div className="container-px mx-auto max-w-7xl py-20 text-center md:py-28">
        <p className="text-muted-foreground">{erro ?? "Sessão inválida."}</p>
        <Button asChild className="mt-6">
          <Link to="/login">Ir para login</Link>
        </Button>
      </div>
    );
  }

  const primeiroNome = cliente.nome.split(" ")[0];
  const enderecoResumo = [
    cliente.endereco,
    cliente.numero,
    cliente.apto,
    cliente.bairro,
    cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade,
    cliente.cep,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="portal-shell">
      <section className="container-px mx-auto max-w-7xl py-20 md:py-28">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            / Minha conta
          </span>
          <h1 className="mt-3 font-display text-5xl font-bold md:text-6xl">
            Olá, <span className="text-gradient-yellow">{primeiroNome}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Acompanhe seus dados, bikes e ordens de serviço em um só lugar.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <CardMenu
            ativo={painel === "dados"}
            onClick={() => setPainel("dados")}
            icon={UserRound}
            titulo="Meus Dados"
            descricao="Cadastro e contato"
            badge="Ativo"
          />
          <CardMenu
            ativo={painel === "bikes"}
            onClick={() => setPainel("bikes")}
            icon={Bike}
            titulo="Minhas Bikes"
            descricao={
              loadingListas
                ? "Carregando…"
                : bikes.length === 1
                  ? "1 bicicleta"
                  : `${bikes.length} bicicletas`
            }
            badge="Ativo"
          />
          <CardMenu
            ativo={painel === "os"}
            onClick={() => setPainel("os")}
            icon={ClipboardList}
            titulo="Minhas OS"
            descricao={
              loadingListas
                ? "Carregando…"
                : ordens.length === 1
                  ? "1 ordem"
                  : `${ordens.length} ordens`
            }
            badge="Ativo"
          />
        </div>

        <div className="mt-12">
          {painel === "dados" && (
            <div className="portal-panel-miolo rounded-2xl border p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-primary">Meus Dados</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {editando
                      ? "Atualize seus dados de contato e endereço. E-mail e CPF só pela loja."
                      : "Informações do seu cadastro na Bike Time"}
                  </p>
                </div>
                {!editando ? (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setForm(formFromCliente(cliente));
                      setEditando(true);
                    }}
                  >
                    <Pencil className="mr-2 size-4" /> Editar
                  </Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={cancelarEdicao}
                      disabled={saving}
                    >
                      <X className="mr-2 size-4" /> Cancelar
                    </Button>
                    <Button className="rounded-full" onClick={salvarDados} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" /> Salvando…
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {!editando ? (
                <dl className="mt-8 grid gap-3 sm:grid-cols-2">
                  <Campo label="Nome" value={cliente.nome} destaque />
                  <Campo label="E-mail" value={cliente.email} destaque />
                  <Campo label="WhatsApp" value={cliente.whatsapp} destaque />
                  <Campo label="Telefone" value={cliente.telefone_secundario} destaque />
                  <Campo label="CPF" value={cliente.cpf} destaque />
                  <Campo
                    label="Nascimento"
                    value={
                      cliente.data_nascimento
                        ? new Date(cliente.data_nascimento + "T12:00:00").toLocaleDateString(
                            "pt-BR",
                          )
                        : null
                    }
                    destaque
                  />
                  <Campo label="Instagram" value={cliente.instagram} destaque />
                  <Campo
                    label="Endereço"
                    value={enderecoResumo || null}
                    className="sm:col-span-2"
                    destaque
                  />
                </dl>
              ) : (
                <div className="mt-8 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nome *">
                      <Input
                        className="portal-field"
                        value={form.nome}
                        onChange={(e) => set("nome", e.target.value)}
                      />
                    </Field>
                    <Field label="E-mail (somente loja)">
                      <Input className="portal-field" value={cliente.email ?? ""} disabled readOnly />
                    </Field>
                    <Field label="WhatsApp">
                      <Input
                        className="portal-field"
                        value={form.whatsapp}
                        onChange={(e) => set("whatsapp", formatPhoneBr(e.target.value))}
                        inputMode="tel"
                        maxLength={15}
                      />
                    </Field>
                    <Field label="Telefone">
                      <Input
                        className="portal-field"
                        value={form.telefone_secundario}
                        onChange={(e) =>
                          set("telefone_secundario", formatPhoneBr(e.target.value))
                        }
                        inputMode="tel"
                        maxLength={15}
                      />
                    </Field>
                    <Field label="CPF (somente loja)">
                      <Input className="portal-field" value={cliente.cpf ?? ""} disabled readOnly />
                    </Field>
                    <Field label="Nascimento">
                      <Input
                        className="portal-field"
                        type="date"
                        value={form.data_nascimento}
                        onChange={(e) => set("data_nascimento", e.target.value)}
                      />
                    </Field>
                    <Field label="Instagram">
                      <Input
                        className="portal-field"
                        value={form.instagram}
                        onChange={(e) => set("instagram", e.target.value)}
                        placeholder="@seuuser"
                      />
                    </Field>
                    <Field label={buscandoCep ? "CEP (buscando…)" : "CEP"}>
                      <Input
                        className="portal-field"
                        value={form.cep}
                        onChange={(e) => {
                          const v = e.target.value;
                          set("cep", v);
                          if (v.replace(/\D/g, "").length === 8) buscarCep(v);
                        }}
                        onBlur={(e) => buscarCep(e.target.value)}
                        placeholder="00000-000"
                      />
                    </Field>
                    <Field label="Endereço" className="sm:col-span-2">
                      <Input
                        className="portal-field"
                        value={form.endereco}
                        onChange={(e) => set("endereco", e.target.value)}
                      />
                    </Field>
                    <Field label="Número">
                      <Input
                        className="portal-field"
                        value={form.numero}
                        onChange={(e) => set("numero", e.target.value)}
                      />
                    </Field>
                    <Field label="Apto / Complemento">
                      <Input
                        className="portal-field"
                        value={form.apto}
                        onChange={(e) => set("apto", e.target.value)}
                      />
                    </Field>
                    <Field label="Bairro">
                      <Input
                        className="portal-field"
                        value={form.bairro}
                        onChange={(e) => set("bairro", e.target.value)}
                      />
                    </Field>
                    <Field label="Cidade">
                      <Input
                        className="portal-field"
                        value={form.cidade}
                        onChange={(e) => set("cidade", e.target.value)}
                      />
                    </Field>
                    <Field label="Estado">
                      <select
                        value={form.estado}
                        onChange={(e) => set("estado", e.target.value)}
                        className="portal-field flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                      >
                        <option value="">Selecione</option>
                        {ESTADOS.map((uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </div>
          )}

          {painel === "bikes" && (
            <div className="portal-panel-miolo rounded-2xl border p-6 md:p-8">
              <h2 className="font-display text-lg font-semibold text-primary">Minhas Bikes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Bicicletas cadastradas na Bike Time
              </p>
              {loadingListas ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : bikes.length === 0 ? (
                <p className="mt-10 text-center text-muted-foreground py-8">
                  Nenhuma bike cadastrada ainda.
                </p>
              ) : (
                <ul className="mt-8 space-y-3">
                  {bikes.map((b) => (
                    <li
                      key={b.id}
                      className="portal-item rounded-xl border px-5 py-4 transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg font-semibold">
                            {[b.marca, b.modelo].filter(Boolean).join(" ") || "Bike"}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {[
                              b.ano ? String(b.ano) : null,
                              b.cor,
                              b.tamanho ? `Tam. ${b.tamanho}` : null,
                              b.tipo,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                          {b.numero_serie && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Série: {b.numero_serie}
                            </p>
                          )}
                        </div>
                        {b.bike_atual && (
                          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Atual
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {painel === "os" && (
            <div className="portal-panel-miolo rounded-2xl border p-6 md:p-8">
              <h2 className="font-display text-lg font-semibold text-primary">Minhas OS</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Histórico de ordens de serviço
              </p>
              {loadingListas ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              ) : ordens.length === 0 ? (
                <p className="mt-10 text-center text-muted-foreground py-8">
                  Nenhuma ordem de serviço ainda.
                </p>
              ) : (
                <ul className="mt-8 space-y-3">
                  {ordens.map((o) => {
                    const bikeNome = o.bikes
                      ? [o.bikes.marca, o.bikes.modelo].filter(Boolean).join(" ")
                      : null;
                    const total =
                      o.valor_aprovado != null
                        ? Number(o.valor_aprovado)
                        : Number(o.valor_mao_obra ?? 0) + Number(o.valor_pecas ?? 0);
                    return (
                      <li
                        key={o.id}
                        className="portal-item rounded-xl border px-5 py-4 transition-colors"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-sm font-semibold text-primary">
                              {o.numero}
                            </p>
                            <p className="mt-1 font-display text-base font-semibold">
                              {bikeNome || "Bike"}
                            </p>
                            {o.problema_relatado && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {o.problema_relatado}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-muted-foreground">
                              {[
                                o.created_at
                                  ? `Entrada ${new Date(o.created_at).toLocaleDateString("pt-BR")}`
                                  : null,
                                o.data_prevista
                                  ? `Prevista ${new Date(o.data_prevista + "T12:00:00").toLocaleDateString("pt-BR")}`
                                  : null,
                                o.proxima_revisao
                                  ? `Próx. revisão ${new Date(o.proxima_revisao + "T12:00:00").toLocaleDateString("pt-BR")}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                              {STATUS_OS[o.status] ?? o.status.replace(/_/g, " ")}
                            </span>
                            {total > 0 && (
                              <p className="mt-2 text-sm font-medium">
                                {total.toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Card de navegação do painel (mesmo estilo dos blocos de Contato/Serviços).
 */
function CardMenu({
  ativo,
  onClick,
  icon: Icon,
  titulo,
  descricao,
  badge,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof UserRound;
  titulo: string;
  descricao: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hover-lift group flex w-full items-center gap-5 rounded-2xl border p-6 text-left",
        ativo ? "portal-panel-active" : "portal-panel",
      )}
    >
      <div
        className={cn(
          "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
          ativo
            ? "bg-primary text-primary-foreground"
            : "border border-primary/30 bg-primary/10 text-primary",
        )}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-primary">{titulo}</h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              badge === "Ativo"
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {badge}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
    </button>
  );
}

function Campo({
  label,
  value,
  className,
  destaque,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        className,
        destaque && "portal-item rounded-xl border px-4 py-3",
      )}
    >
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
