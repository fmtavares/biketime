-- Compras e parcelas (contas a pagar) por fornecedor

CREATE TABLE public.compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
  data_compra date NOT NULL DEFAULT current_date,
  forma_pagamento text NOT NULL,
  valor_total numeric NOT NULL DEFAULT 0,
  numero_nf text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compras_fornecedor ON public.compras (fornecedor_id);
CREATE INDEX idx_compras_data ON public.compras (data_compra DESC);

CREATE TABLE public.compra_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  valor numeric NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_compra_itens_compra ON public.compra_itens (compra_id);

CREATE TABLE public.compra_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  numero int NOT NULL,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'paga')),
  data_pagamento timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compra_id, numero)
);

CREATE INDEX idx_compra_parcelas_compra ON public.compra_parcelas (compra_id);
CREATE INDEX idx_compra_parcelas_vencimento ON public.compra_parcelas (data_vencimento, status);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY compras_read ON public.compras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY compras_insert_admin ON public.compras
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compras_update_admin ON public.compras
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compras_delete_admin ON public.compras
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY compra_itens_read ON public.compra_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY compra_itens_insert_admin ON public.compra_itens
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compra_itens_update_admin ON public.compra_itens
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compra_itens_delete_admin ON public.compra_itens
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY compra_parcelas_read ON public.compra_parcelas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY compra_parcelas_insert_admin ON public.compra_parcelas
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compra_parcelas_update_admin ON public.compra_parcelas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY compra_parcelas_delete_admin ON public.compra_parcelas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_compras_set_updated_at
  BEFORE UPDATE ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_compra_parcelas_set_updated_at
  BEFORE UPDATE ON public.compra_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
