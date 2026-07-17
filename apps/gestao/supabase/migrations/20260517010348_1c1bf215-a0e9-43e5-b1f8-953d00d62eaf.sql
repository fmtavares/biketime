-- Tabela produtos
CREATE TABLE public.produtos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text,
  codigo_barras text,
  nome text NOT NULL,
  descricao text,
  categoria text,
  marca text,
  modelo text,
  unidade text DEFAULT 'UN',
  custo numeric NOT NULL DEFAULT 0,
  preco_venda numeric NOT NULL DEFAULT 0,
  valor_minimo numeric,
  estoque_atual numeric NOT NULL DEFAULT 0,
  estoque_minimo numeric NOT NULL DEFAULT 0,
  fornecedor text,
  fotos text[] DEFAULT '{}'::text[],
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  visivel_ecommerce boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices úteis
CREATE INDEX idx_produtos_nome ON public.produtos (nome);
CREATE INDEX idx_produtos_sku ON public.produtos (sku);
CREATE INDEX idx_produtos_categoria ON public.produtos (categoria);
CREATE INDEX idx_produtos_marca ON public.produtos (marca);
CREATE INDEX idx_produtos_ativo ON public.produtos (ativo);

-- RLS
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY produtos_read
  ON public.produtos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY produtos_insert_admin
  ON public.produtos
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY produtos_update_admin
  ON public.produtos
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY produtos_delete_admin
  ON public.produtos
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at (usa função existente public.set_updated_at)
CREATE TRIGGER trg_produtos_set_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();