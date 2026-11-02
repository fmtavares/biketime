import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { fmtPreco } from "@/lib/loja";
import { useCarrinho } from "@/lib/carrinho";

export const Route = createFileRoute("/loja_/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho — Showroom BikeTime" }] }),
  component: CarrinhoPage,
});

/**
 * Lista o carrinho local e segue para o fechamento.
 * O estoque só é conferido de novo quando o pedido é gravado.
 */
function CarrinhoPage() {
  const { itens, subtotal, alterarQuantidade, remover } = useCarrinho();

  return (
    <div className="container-px mx-auto max-w-3xl py-12 md:py-16">
      <h1 className="font-display text-3xl font-bold">Carrinho</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A loja confirma a disponibilidade depois. Nada é cobrado nesta etapa.
      </p>

      {itens.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-border p-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto h-8 w-8 opacity-50" />
          <p className="mt-3">Seu carrinho está vazio.</p>
          <Link to="/loja" className="mt-4 inline-block text-sm font-semibold text-primary">
            Voltar ao showroom
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {itens.map((item) => (
            <div
              key={item.chave}
              className="flex gap-4 rounded-2xl border border-border p-4"
            >
              <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary/40">
                {item.foto ? (
                  <img src={item.foto} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{item.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {item.tipo === "bike" ? "Bike" : "Produto"}
                  {item.tamanho ? ` · Tam. ${item.tamanho}` : ""}
                </p>
                <p className="mt-1 text-sm">{fmtPreco(item.preco)}</p>
                <div className="mt-2 flex items-center gap-2">
                  {item.tipo === "produto" && (
                    <>
                      <button
                        type="button"
                        className="rounded-md border p-1"
                        onClick={() => alterarQuantidade(item.chave, item.quantidade - 1)}
                        aria-label="Diminuir"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantidade}</span>
                      <button
                        type="button"
                        className="rounded-md border p-1"
                        onClick={() => alterarQuantidade(item.chave, item.quantidade + 1)}
                        aria-label="Aumentar"
                      >
                        <Plus size={14} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-foreground"
                    onClick={() => remover(item.chave)}
                    aria-label="Remover"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-lg font-bold">{fmtPreco(subtotal)}</span>
          </div>
          <Link
            to="/loja/checkout"
            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Fechar pedido
          </Link>
        </div>
      )}
    </div>
  );
}
