import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatCpf, formatPhoneBr } from "@/lib/utils";
import { definirAcessoCliente } from "@/lib/cliente-acesso.functions";
import { listarUsuariosEquipe } from "@/lib/usuarios-sistema";

const ORIGENS = ["Instagram", "Indicação", "Loja", "Site", "Evento"];
const NIVEIS = ["Iniciante", "Intermediário", "Avançado"];
const FREQ = ["Diário", "2-3x semana", "Fim de semana"];
const OBJETIVOS = ["Performance", "Lazer", "Competição", "Saúde"];
const MODALIDADES = ["MTB", "Speed", "Gravel", "Triathlon", "Urbano", "Infantil"];
const ESTADOS = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

export function ClienteFormDialog({
  open,
  onOpenChange,
  onSaved,
  cliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  cliente?: any;
}) {
  const [form, setForm] = useState<any>({
    nome: "",
    whatsapp: "",
    telefone_secundario: "",
    email: "",
    cpf: "",
    cep: "",
    endereco: "",
    numero: "",
    apto: "",
    bairro: "",
    cidade: "",
    estado: "",
    data_nascimento: "",
    instagram: "",
    vendedor_responsavel: "",
    vip: false,
    observacoes: "",
    origem_lead: "",
    modalidades: [] as string[],
    nivel: "",
    frequencia: "",
    objetivo: "",
    participa_provas: false,
    equipe: "",
    tamanho_bike: "",
    altura: "",
    marca_preferida: "",
    sonho_consumo: "",
  });
  const [busy, setBusy] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [marcas, setMarcas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  /** Senha do portal (só Auth; nunca grava em `clientes`). */
  const [senhaAcesso, setSenhaAcesso] = useState("");
  const [busyAcesso, setBusyAcesso] = useState(false);
  const [temAcesso, setTemAcesso] = useState(false);
  const definirAcesso = useServerFn(definirAcessoCliente);

  useEffect(() => {
    if (open) {
      setSenhaAcesso("");
      if (cliente) {
        setForm({
          ...cliente,
          modalidades: cliente.modalidades ?? [],
          whatsapp: formatPhoneBr(cliente.whatsapp ?? ""),
          telefone_secundario: formatPhoneBr(cliente.telefone_secundario ?? ""),
          cpf: formatCpf(cliente.cpf ?? ""),
        });
        setTemAcesso(Boolean(cliente.user_id));
      } else {
        setForm({
          nome: "",
          whatsapp: "",
          telefone_secundario: "",
          email: "",
          cpf: "",
          cep: "",
          endereco: "",
          numero: "",
          apto: "",
          bairro: "",
          cidade: "",
          estado: "",
          data_nascimento: "",
          instagram: "",
          vendedor_responsavel: "",
          vip: false,
          observacoes: "",
          origem_lead: "",
          modalidades: [] as string[],
          nivel: "",
          frequencia: "",
          objetivo: "",
          participa_provas: false,
          equipe: "",
          tamanho_bike: "",
          altura: "",
          marca_preferida: "",
          sonho_consumo: "",
        });
        setTemAcesso(false);
      }
    }
  }, [open, cliente]);

  useEffect(() => {
    if (open) {
      supabase.from("marcas_bikes").select("id, nome").order("nome").then(({ data }) => setMarcas(data ?? []));
      void listarUsuariosEquipe().then(setUsuarios);
    }
  }, [open]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleMod = (m: string) =>
    set(
      "modalidades",
      form.modalidades.includes(m)
        ? form.modalidades.filter((x: string) => x !== m)
        : [...form.modalidades, m],
    );

  /**
   * Cria ou redefine a senha do portal do cliente (Auth).
   */
  async function salvarAcesso(clienteId: string) {
    if (!form.email?.trim()) {
      toast.error("Informe o e-mail do cliente para criar o acesso");
      return false;
    }
    if (!senhaAcesso || senhaAcesso.length < 6) {
      toast.error("Senha do portal deve ter pelo menos 6 caracteres");
      return false;
    }
    setBusyAcesso(true);
    try {
      const res = await definirAcesso({
        data: {
          clienteId,
          email: form.email.trim(),
          password: senhaAcesso,
          nome: form.nome,
        },
      });
      if (!res?.ok) {
        toast.error(res?.error || "Erro ao definir acesso");
        setTemAcesso(false);
        return false;
      }
      setTemAcesso(true);
      setSenhaAcesso("");
      if (res.emailEquipe) {
        toast.success(
          "Acesso vinculado. Este e-mail é da equipe: a mesma senha vale no site e na gestão.",
        );
      } else {
        toast.success(res.criado ? "Acesso do portal criado" : "Senha do portal atualizada");
      }
      onSaved?.();
      return true;
    } catch (e: any) {
      const msg =
        typeof e === "string"
          ? e
          : e?.message || (await e?.text?.()) || "Erro ao definir acesso";
      toast.error(String(msg));
      setTemAcesso(false);
      return false;
    } finally {
      setBusyAcesso(false);
    }
  }

  const buscarCep = async (raw: string) => {
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
      setForm((f: any) => ({
        ...f,
        endereco: data.logradouro ?? f.endereco,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        estado: data.uf ?? f.estado,
      }));
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setBuscandoCep(false);
    }
  };

  const save = async () => {
    if (!form.nome) {
      toast.error("Nome é obrigatório");
      return;
    }
    setBusy(true);
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      user_id: _uid,
      ...rest
    } = form;
    const payload = {
      ...rest,
      data_nascimento: form.data_nascimento || null,
    };
    let clienteId = cliente?.id as string | undefined;
    if (cliente) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.id);
      setBusy(false);
      if (error) return toast.error(error.message);
    } else {
      const { data: criado, error } = await supabase
        .from("clientes")
        .insert(payload)
        .select("id")
        .single();
      setBusy(false);
      if (error) return toast.error(error.message);
      clienteId = criado.id;
    }

    if (senhaAcesso.trim()) {
      const ok = await salvarAcesso(clienteId!);
      if (!ok) return;
    }

    toast.success(cliente ? "Cliente atualizado" : "Cliente criado");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basico">
          <TabsList>
            <TabsTrigger value="basico">Informações</TabsTrigger>
            <TabsTrigger value="ciclista">Perfil do ciclista</TabsTrigger>
            <TabsTrigger value="acesso">Acesso ao site</TabsTrigger>
          </TabsList>

          <TabsContent value="basico" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome completo *">
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </Field>
              <Field label="WhatsApp principal">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", formatPhoneBr(e.target.value))}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </Field>
              <Field label="Telefone secundário">
                <Input
                  value={form.telefone_secundario}
                  onChange={(e) => set("telefone_secundario", formatPhoneBr(e.target.value))}
                  inputMode="tel"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </Field>
              <Field label="E-mail">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Instagram">
                <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
              </Field>
              <Field label="CPF">
                <Input
                  value={form.cpf}
                  onChange={(e) => set("cpf", formatCpf(e.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </Field>
              <Field label="Data de nascimento">
                <Input
                  type="date"
                  value={form.data_nascimento ?? ""}
                  onChange={(e) => set("data_nascimento", e.target.value)}
                />
              </Field>
              <Field label={buscandoCep ? "CEP (buscando…)" : "CEP"}>
                <Input
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
              <Field label="Endereço">
                <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
              </Field>
              <Field label="Número">
                <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} />
              </Field>
              <Field label="Apto / Complemento">
                <Input value={form.apto} onChange={(e) => set("apto", e.target.value)} />
              </Field>
              <Field label="Bairro">
                <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
              </Field>
              <Field label="Cidade">
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
              </Field>
              <Field label="Estado">
                <Select value={form.estado || ""} onValueChange={(v) => set("estado", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(([uf, nome]) => (
                      <SelectItem key={uf} value={uf}>{uf} - {nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Responsável">
                <Select value={form.vendedor_responsavel || ""} onValueChange={(v) => set("vendedor_responsavel", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => {
                      const n = u.full_name ?? u.email;
                      return <SelectItem key={u.id} value={n}>{n}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Origem do lead">
                <Select value={form.origem_lead} onValueChange={(v) => set("origem_lead", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.vip} onCheckedChange={(v) => set("vip", v)} id="vip" />
              <Label htmlFor="vip">Cliente VIP</Label>
            </div>
            <Field label="Observações gerais">
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
            </Field>
          </TabsContent>

          <TabsContent value="ciclista" className="space-y-4 mt-4">
            <Field label="Modalidades">
              <div className="flex flex-wrap gap-2">
                {MODALIDADES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMod(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      form.modalidades.includes(m)
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background hover:bg-secondary"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Nível">
                <Select value={form.nivel} onValueChange={(v) => set("nivel", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{NIVEIS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Frequência">
                <Select value={form.frequencia} onValueChange={(v) => set("frequencia", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{FREQ.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Objetivo">
                <Select value={form.objetivo} onValueChange={(v) => set("objetivo", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{OBJETIVOS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.participa_provas}
                onCheckedChange={(v) => set("participa_provas", v)}
                id="provas"
              />
              <Label htmlFor="provas">Participa de provas</Label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Equipe / Assessoria"><Input value={form.equipe} onChange={(e) => set("equipe", e.target.value)} /></Field>
              <Field label="Tamanho da bike"><Input value={form.tamanho_bike} onChange={(e) => set("tamanho_bike", e.target.value)} /></Field>
              <Field label="Altura"><Input value={form.altura} onChange={(e) => set("altura", e.target.value)} /></Field>
              <Field label="Marca preferida">
                <Select value={form.marca_preferida || ""} onValueChange={(v) => set("marca_preferida", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{marcas.map((m) => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Sonho de consumo" className="md:col-span-2">
                <Input value={form.sonho_consumo} onChange={(e) => set("sonho_consumo", e.target.value)} placeholder="Ex.: S-Works, SuperSix EVO…" />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="acesso" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Define e-mail e senha para o cliente entrar no site (área logada). A senha fica só no Auth, não no cadastro.
            </p>
            <div className="rounded-lg border px-3 py-2 text-sm">
              Status:{" "}
              <span className="font-medium">
                {temAcesso ? "Acesso ativo" : "Sem acesso ao portal"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="E-mail de login *">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="cliente@email.com"
                />
              </Field>
              <Field label={temAcesso ? "Nova senha" : "Senha inicial"}>
                <Input
                  type="password"
                  value={senhaAcesso}
                  onChange={(e) => setSenhaAcesso(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
              </Field>
            </div>
            {cliente?.id && (
              <Button
                type="button"
                variant="secondary"
                disabled={busyAcesso}
                onClick={() => salvarAcesso(cliente.id)}
              >
                {busyAcesso
                  ? "Salvando acesso…"
                  : temAcesso
                    ? "Redefinir senha"
                    : "Criar acesso agora"}
              </Button>
            )}
            {!cliente?.id && (
              <p className="text-xs text-muted-foreground">
                Em cliente novo: preencha a senha e clique em Salvar — o acesso é criado junto com o cadastro.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={busy || busyAcesso}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
