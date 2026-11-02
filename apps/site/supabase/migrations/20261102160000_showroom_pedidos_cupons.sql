-- Pedido do showroom, cupom e parceiro.
-- Confirmar a compra não altera estoque nem o status da bike.

CREATE TABLE public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.parceiros IS
  'Quem indica a venda. O cupom aponta para um parceiro; a compra não pede esse nome.';

CREATE TABLE public.cupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('percentual', 'valor')),
  valor numeric NOT NULL CHECK (valor > 0),
  ativo boolean NOT NULL DEFAULT true,
  valido_ate date,
  limite_usos integer CHECK (limite_usos IS NULL OR limite_usos > 0),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cupons_codigo_unico UNIQUE (codigo),
  CONSTRAINT cupons_percentual_max CHECK (tipo <> 'percentual' OR valor <= 100)
);

CREATE UNIQUE INDEX cupons_codigo_lower_idx ON public.cupons (lower(codigo));

COMMENT ON TABLE public.cupons IS
  'Código de desconto já vinculado a um parceiro. Na compra o cliente informa só o código.';

CREATE SEQUENCE public.pedidos_numero_seq;

CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero integer NOT NULL DEFAULT nextval('public.pedidos_numero_seq'),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  status text NOT NULL DEFAULT 'aguardando_loja'
    CHECK (status IN ('aguardando_loja', 'confirmado', 'cancelado')),
  subtotal numeric NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  desconto numeric NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  total numeric NOT NULL DEFAULT 0 CHECK (total >= 0),
  cupom_id uuid REFERENCES public.cupons(id),
  parceiro_id uuid REFERENCES public.parceiros(id),
  codigo_cupom text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_numero_unico UNIQUE (numero)
);

ALTER SEQUENCE public.pedidos_numero_seq OWNED BY public.pedidos.numero;

COMMENT ON TABLE public.pedidos IS
  'Pedido do showroom aguardando a loja. Não baixa estoque.';

CREATE TABLE public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('bike', 'produto')),
  bike_estoque_id uuid REFERENCES public.bikes_estoque(id),
  produto_id uuid REFERENCES public.produtos(id),
  produto_variante_id uuid REFERENCES public.produto_variantes(id) ON DELETE SET NULL,
  nome text NOT NULL,
  tamanho text,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  preco_unitario numeric NOT NULL CHECK (preco_unitario >= 0),
  CONSTRAINT pedido_itens_origem CHECK (
    (tipo = 'bike' AND bike_estoque_id IS NOT NULL AND produto_id IS NULL)
    OR (tipo = 'produto' AND produto_id IS NOT NULL AND bike_estoque_id IS NULL)
  )
);

CREATE INDEX idx_pedido_itens_pedido ON public.pedido_itens (pedido_id);
CREATE INDEX idx_pedidos_cliente ON public.pedidos (cliente_id);
CREATE INDEX idx_pedidos_cupom ON public.pedidos (cupom_id);

ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

-- Parceiros e cupons: só a equipe. O código não fica público.
CREATE POLICY parceiros_staff_all ON public.parceiros
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY cupons_staff_all ON public.cupons
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Cliente lê o próprio pedido; equipe lê e atualiza o status.
CREATE POLICY pedidos_select ON public.pedidos
  FOR SELECT TO authenticated
  USING (
    public.is_staff(auth.uid())
    OR cliente_id IN (
      SELECT c.id FROM public.clientes c WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY pedidos_update_staff ON public.pedidos
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY pedido_itens_select ON public.pedido_itens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = pedido_id
        AND (
          public.is_staff(auth.uid())
          OR p.cliente_id IN (
            SELECT c.id FROM public.clientes c WHERE c.user_id = auth.uid()
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupons TO authenticated;
GRANT SELECT, UPDATE ON public.pedidos TO authenticated;
GRANT SELECT ON public.pedido_itens TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pedidos_numero_seq TO authenticated;
