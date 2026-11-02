import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CHAVE_STORAGE = "bt-showroom-carrinho";

/** Linha do carrinho do showroom. O preço exibido é conferido de novo no servidor. */
export type ItemCarrinho = {
  chave: string;
  tipo: "bike" | "produto";
  bikeEstoqueId?: string;
  produtoId?: string;
  varianteId?: string | null;
  nome: string;
  tamanho?: string | null;
  quantidade: number;
  preco: number;
  foto?: string | null;
};

type CarrinhoContexto = {
  itens: ItemCarrinho[];
  quantidade: number;
  subtotal: number;
  adicionar: (item: ItemCarrinho) => void;
  alterarQuantidade: (chave: string, quantidade: number) => void;
  remover: (chave: string) => void;
  limpar: () => void;
};

const Ctx = createContext<CarrinhoContexto | null>(null);

/** Chave estável de uma bike no carrinho (uma unidade). */
export function chaveBike(id: string) {
  return `bike:${id}`;
}

/** Chave estável de um produto, separando o tamanho quando há variante. */
export function chaveProduto(produtoId: string, varianteId?: string | null) {
  return `produto:${produtoId}:${varianteId ?? ""}`;
}

/**
 * Guarda o carrinho no navegador até o pedido ser confirmado.
 * Não reserva estoque.
 */
export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const cru = localStorage.getItem(CHAVE_STORAGE);
      if (cru) setItens(JSON.parse(cru) as ItemCarrinho[]);
    } catch {
      /* carrinho corrompido: começa vazio */
    }
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
  }, [itens, pronto]);

  const valor = useMemo<CarrinhoContexto>(() => {
    /**
     * Inclui o item. Bike repetida não duplica. Produto do mesmo tamanho soma a quantidade.
     */
    function adicionar(item: ItemCarrinho) {
      setItens((lista) => {
        const atual = lista.find((i) => i.chave === item.chave);
        if (!atual) return [...lista, item];
        if (item.tipo === "bike") return lista;
        return lista.map((i) =>
          i.chave === item.chave
            ? { ...i, quantidade: Math.min(99, i.quantidade + item.quantidade) }
            : i,
        );
      });
    }

    /** Ajusta a quantidade. Bike permanece em 1. Zero remove a linha. */
    function alterarQuantidade(chave: string, quantidade: number) {
      setItens((lista) =>
        lista.flatMap((i) => {
          if (i.chave !== chave) return [i];
          if (i.tipo === "bike") return [i];
          if (quantidade <= 0) return [];
          return [{ ...i, quantidade: Math.min(99, quantidade) }];
        }),
      );
    }

    /** Tira uma linha do carrinho. */
    function remover(chave: string) {
      setItens((lista) => lista.filter((i) => i.chave !== chave));
    }

    /** Esvazia o carrinho depois que o pedido é gravado. */
    function limpar() {
      setItens([]);
    }

    return {
      itens,
      quantidade: itens.reduce((s, i) => s + i.quantidade, 0),
      subtotal: itens.reduce((s, i) => s + i.preco * i.quantidade, 0),
      adicionar,
      alterarQuantidade,
      remover,
      limpar,
    };
  }, [itens]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/** Acesso ao carrinho. Só funciona dentro de CarrinhoProvider. */
export function useCarrinho() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCarrinho fora do CarrinhoProvider");
  return ctx;
}
