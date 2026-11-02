import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtPreco } from "@/lib/loja";
import { formatPhoneBr } from "@/lib/utils";
import { useCarrinho } from "@/lib/carrinho";
import {
  aplicarCupom,
  cadastrarClienteShowroom,
  confirmarPedido,
} from "@/lib/loja-pedido.functions";

export const Route = createFileRoute("/loja_/checkout")({
  head: () => ({ meta: [{ title: "Fechar pedido — Showroom BikeTime" }] }),
  component: CheckoutPage,
});

const ESTADOS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

type FichaCliente = {
  id: string;
  whatsapp: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
};

/**
 * Fecha o pedido do showroom.
 * Sem conta, cadastra contato e endereço. Quem já entrou completa só o que falta.
 */
function CheckoutPage() {
  const navigate = useNavigate();
  const { itens, subtotal, limpar } = useCarrinho();
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [fichaOk, setFichaOk] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [apto, setApto] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [instagram, setInstagram] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [cupomOk, setCupomOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) {
        setLogado(false);
        setPronto(true);
        return;
      }
      setLogado(true);
      const { data: cliente } = await (supabase as any)
        .from("clientes")
        .select("id, whatsapp, cep, endereco, numero, bairro, cidade, estado")
        .eq("user_id", user.id)
        .maybeSingle();
      const ficha = cliente as FichaCliente | null;
      if (ficha) {
        setClienteId(ficha.id);
        setWhatsapp(formatPhoneBr(ficha.whatsapp ?? ""));
        setCep(ficha.cep ?? "");
        setEndereco(ficha.endereco ?? "");
        setNumero(ficha.numero ?? "");
        setBairro(ficha.bairro ?? "");
        setCidade(ficha.cidade ?? "");
        setEstado(ficha.estado ?? "");
        setFichaOk(enderecoCompleto(ficha));
      }
      setPronto(true);
    });
  }, []);

  /** Payload que o servidor usa para recalcular o preço. */
  function itensServidor() {
    return itens.map((i) => ({
      tipo: i.tipo,
      bikeEstoqueId: i.bikeEstoqueId,
      produtoId: i.produtoId,
      varianteId: i.varianteId ?? null,
      quantidade: i.quantidade,
    }));
  }

  /**
   * Confere o código. O parceiro não é pedido aqui: já está no cadastro do cupom.
   */
  async function onCupom(e: FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setBusy(true);
    const res = await aplicarCupom({ data: { itens: itensServidor(), codigo } });
    setBusy(false);
    if (!res.ok) {
      setDesconto(0);
      setCupomOk(null);
      return toast.error(res.error);
    }
    setDesconto(res.desconto);
    setCupomOk(res.codigo);
    toast.success("Cupom aplicado");
  }

  /**
   * Preenche logradouro, bairro, cidade e estado a partir do CEP.
   */
  async function buscarCep(raw: string) {
    const digitos = raw.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      if (data.logradouro) setEndereco(data.logradouro);
      if (data.bairro) setBairro(data.bairro);
      if (data.localidade) setCidade(data.localidade);
      if (data.uf) setEstado(data.uf);
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setBuscandoCep(false);
    }
  }

  /** Campos de contato e endereço enviados no cadastro. */
  function dadosFicha() {
    return {
      whatsapp,
      telefone_secundario: telefone,
      data_nascimento: nascimento,
      cep,
      endereco,
      numero,
      apto,
      bairro,
      cidade,
      estado,
      instagram,
    };
  }

  /**
   * Cria a conta se preciso, grava o endereço que faltar e fecha o pedido.
   */
  async function onConfirmar(e: FormEvent) {
    e.preventDefault();
    if (!itens.length) return;
    const falta = validarFicha();
    if ((!logado || !fichaOk) && falta) {
      toast.error(falta);
      return;
    }
    setBusy(true);
    try {
      if (!logado) {
        const criado = await cadastrarClienteShowroom({
          data: { nome, email, password: senha, ...dadosFicha() },
        });
        if (!criado.ok) {
          toast.error(criado.error);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) {
          toast.error("Conta criada, mas o login falhou. Entre e tente de novo.");
          return;
        }
      } else if (!fichaOk && clienteId) {
        const { error } = await (supabase as any)
          .from("clientes")
          .update({
            whatsapp: whatsapp.trim(),
            cep: cep.replace(/\D/g, ""),
            endereco: endereco.trim(),
            numero: numero.trim(),
            apto: apto.trim() || null,
            bairro: bairro.trim(),
            cidade: cidade.trim(),
            estado: estado.trim().toUpperCase(),
          })
          .eq("id", clienteId);
        if (error) {
          toast.error(error.message || "Não foi possível salvar o endereço.");
          return;
        }
      } else if (!fichaOk) {
        toast.error("Cadastro não encontrado. Fale com a loja.");
        return;
      }

      const res = await confirmarPedido({
        data: { itens: itensServidor(), codigo: cupomOk ?? undefined },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      limpar();
      navigate({ to: "/loja/pedido/$id", params: { id: res.pedido.id } });
    } finally {
      setBusy(false);
    }
  }

  /** Mensagem se WhatsApp ou endereço obrigatório estiver vazio. */
  function validarFicha() {
    if (whatsapp.replace(/\D/g, "").length < 8) return "Informe o WhatsApp.";
    if (cep.replace(/\D/g, "").length !== 8) return "Informe o CEP.";
    if (!endereco.trim() || !numero.trim() || !bairro.trim() || !cidade.trim() || estado.trim().length !== 2) {
      return "Complete o endereço.";
    }
    return null;
  }

  if (!itens.length) {
    return (
      <div className="container-px mx-auto max-w-xl py-16 text-center">
        <p className="text-muted-foreground">Seu carrinho está vazio.</p>
        <Link to="/loja" className="mt-4 inline-block text-sm font-semibold text-primary">
          Ir ao showroom
        </Link>
      </div>
    );
  }

  const total = Math.max(0, subtotal - desconto);
  const pedeFicha = !logado || !fichaOk;

  return (
    <div className="container-px mx-auto max-w-xl py-12">
      <h1 className="font-display text-3xl font-bold">Fechar pedido</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Retirada na loja. Sem pagamento online: a Bike Time confirma a disponibilidade.
      </p>

      <ul className="mt-8 space-y-2 text-sm">
        {itens.map((i) => (
          <li key={i.chave} className="flex justify-between gap-3">
            <span>
              {i.nome}
              {i.tamanho ? ` · ${i.tamanho}` : ""} × {i.quantidade}
            </span>
            <span>{fmtPreco(i.preco * i.quantidade)}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={onCupom} className="mt-6 flex gap-2">
        <input
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            setCupomOk(null);
            setDesconto(0);
          }}
          placeholder="Cupom"
          className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
          aria-label="Código do cupom"
        />
        <button
          type="submit"
          disabled={busy || !codigo.trim()}
          className="rounded-full border px-4 text-sm font-semibold"
        >
          Aplicar
        </button>
      </form>
      {cupomOk && (
        <p className="mt-2 text-xs text-muted-foreground">Cupom {cupomOk} aplicado.</p>
      )}

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{fmtPreco(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex justify-between">
            <span>Desconto</span>
            <span>- {fmtPreco(desconto)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span>{fmtPreco(total)}</span>
        </div>
      </div>

      <form onSubmit={onConfirmar} className="mt-8 space-y-3">
        {!pronto ? (
          <p className="text-sm text-muted-foreground">Carregando cadastro…</p>
        ) : (
          <>
            {!logado && (
              <>
                <p className="text-sm">
                  Crie sua conta para acompanhar o pedido.{" "}
                  <Link to="/login" search={{ redirect: "/loja/checkout" }} className="font-semibold text-primary">
                    Já tenho conta
                  </Link>
                </p>
                <Campo label="Nome" value={nome} onChange={setNome} required />
                <Campo label="E-mail" value={email} onChange={setEmail} type="email" required />
                <Campo label="Senha" value={senha} onChange={setSenha} type="password" required />
              </>
            )}
            {logado && !fichaOk && (
              <p className="text-sm text-muted-foreground">
                Complete o contato e o endereço para fechar o pedido.
              </p>
            )}
            {pedeFicha && (
              <>
                <Campo
                  label="WhatsApp"
                  value={whatsapp}
                  onChange={(v) => setWhatsapp(formatPhoneBr(v))}
                  required
                />
                {!logado && (
                  <>
                    <Campo
                      label="Telefone"
                      value={telefone}
                      onChange={(v) => setTelefone(formatPhoneBr(v))}
                    />
                    <Campo label="Nascimento" value={nascimento} onChange={setNascimento} type="date" />
                  </>
                )}
                <Campo
                  label={buscandoCep ? "CEP (buscando…)" : "CEP"}
                  value={cep}
                  onChange={(v) => {
                    setCep(v);
                    if (v.replace(/\D/g, "").length === 8) void buscarCep(v);
                  }}
                  required
                />
                <Campo label="Endereço" value={endereco} onChange={setEndereco} required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Número" value={numero} onChange={setNumero} required />
                  <Campo label="Complemento" value={apto} onChange={setApto} />
                </div>
                <Campo label="Bairro" value={bairro} onChange={setBairro} required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo label="Cidade" value={cidade} onChange={setCidade} required />
                  <label className="block space-y-1 text-sm">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Estado</span>
                    <select
                      required
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3"
                    >
                      <option value="">UF</option>
                      {ESTADOS.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!logado && <Campo label="Instagram" value={instagram} onChange={setInstagram} />}
              </>
            )}
          </>
        )}
        <button
          type="submit"
          disabled={busy || !pronto}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Confirmar pedido"}
        </button>
      </form>
    </div>
  );
}

/**
 * Diz se a ficha já tem WhatsApp e o endereço obrigatório.
 */
function enderecoCompleto(c: Omit<FichaCliente, "id">) {
  const ok = (v?: string | null) => Boolean(v && v.trim());
  return (
    ok(c.whatsapp) &&
    String(c.cep ?? "").replace(/\D/g, "").length === 8 &&
    ok(c.endereco) &&
    ok(c.numero) &&
    ok(c.bairro) &&
    ok(c.cidade) &&
    ok(c.estado)
  );
}

/** Campo simples do cadastro no checkout. */
function Campo({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3"
      />
    </label>
  );
}
