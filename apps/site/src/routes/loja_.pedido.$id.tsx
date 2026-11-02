import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fmtPreco } from "@/lib/loja";
import { lerPedido } from "@/lib/loja-pedido.functions";

export const Route = createFileRoute("/loja_/pedido/$id")({
  head: () => ({ meta: [{ title: "Pedido — Showroom BikeTime" }] }),
  component: PedidoPage,
});

type PedidoView = {
  numero: number;
  subtotal: number;
  desconto: number;
  total: number;
  codigo_cupom: string | null;
};

type ItemView = {
  id: string;
  nome: string;
  tamanho: string | null;
  quantidade: number;
  preco_unitario: number;
};

/**
 * Confirmação do pedido. O estoque não foi alterado; a loja ainda vai confirmar.
 */
function PedidoPage() {
  const { id } = Route.useParams();
  const [pedido, setPedido] = useState<PedidoView | null>(null);
  const [itens, setItens] = useState<ItemView[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    lerPedido({ data: { id } }).then((res) => {
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setPedido(res.pedido);
      setItens(res.itens);
    });
  }, [id]);

  if (erro) {
    return <p className="container-px mx-auto max-w-xl py-16 text-muted-foreground">{erro}</p>;
  }
  if (!pedido) {
    return <p className="container-px mx-auto max-w-xl py-16 text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="container-px mx-auto max-w-xl py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pedido recebido</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Número {pedido.numero}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        A Bike Time confirma a disponibilidade. Não há pagamento online nesta etapa e o estoque da vitrine continua como está.
      </p>
      <ul className="mt-8 space-y-2 text-sm">
        {itens.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.nome}
              {i.tamanho ? ` · ${i.tamanho}` : ""} × {Number(i.quantidade)}
            </span>
            <span>{fmtPreco(Number(i.preco_unitario) * Number(i.quantidade))}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{fmtPreco(Number(pedido.subtotal))}</span>
        </div>
        {Number(pedido.desconto) > 0 && (
          <div className="flex justify-between">
            <span>Desconto{pedido.codigo_cupom ? ` (${pedido.codigo_cupom})` : ""}</span>
            <span>- {fmtPreco(Number(pedido.desconto))}</span>
          </div>
        )}
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{fmtPreco(Number(pedido.total))}</span>
        </div>
      </div>
      <Link to="/minha-conta" className="mt-8 inline-block text-sm font-semibold text-primary">
        Ir para minha conta
      </Link>
    </div>
  );
}
