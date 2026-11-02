import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtPreco } from "@/lib/loja";
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

/**
 * Fecha o pedido do showroom.
 * Sem conta, cadastra o cliente. O único dado comercial extra é o código do cupom.
 */
function CheckoutPage() {
  const navigate = useNavigate();
  const { itens, subtotal, limpar } = useCarrinho();
  const [logado, setLogado] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [codigo, setCodigo] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [cupomOk, setCupomOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogado(Boolean(data.session?.user));
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
   * Cria a conta se preciso, grava o pedido e esvazia o carrinho.
   */
  async function onConfirmar(e: FormEvent) {
    e.preventDefault();
    if (!itens.length) return;
    setBusy(true);
    try {
      if (!logado) {
        const criado = await cadastrarClienteShowroom({
          data: { nome, email, password: senha, whatsapp },
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
            <Campo label="WhatsApp" value={whatsapp} onChange={setWhatsapp} required />
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Confirmar pedido"}
        </button>
      </form>
    </div>
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
