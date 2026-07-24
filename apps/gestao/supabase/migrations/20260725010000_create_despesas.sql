-- Despesas do dia a dia + categorias + recorrentes

CREATE TABLE public.despesa_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.despesa_categorias (nome, slug, ordem) VALUES
  ('Operacionais', 'operacionais', 10),
  ('Insumos oficina', 'insumos-oficina', 40),
  ('Peças Avulsas', 'pecas-avulsas', 45),
  ('Diversos', 'diversos', 90);

CREATE TABLE public.despesa_recorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.despesa_categorias(id) ON DELETE SET NULL,
  dia_vencimento int NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 28),
  valor_estimado numeric,
  forma_pagamento text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despesa_recorrentes_ativo ON public.despesa_recorrentes (ativo);

CREATE TABLE public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.despesa_categorias(id) ON DELETE SET NULL,
  recorrente_id uuid REFERENCES public.despesa_recorrentes(id) ON DELETE SET NULL,
  data_vencimento date NOT NULL,
  competencia date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  status text NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista', 'paga')),
  data_pagamento timestamptz,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_despesas_vencimento ON public.despesas (data_vencimento, status);
CREATE INDEX idx_despesas_competencia ON public.despesas (competencia);
CREATE INDEX idx_despesas_recorrente ON public.despesas (recorrente_id);
CREATE UNIQUE INDEX idx_despesas_recorrente_competencia
  ON public.despesas (recorrente_id, competencia)
  WHERE recorrente_id IS NOT NULL;

ALTER TABLE public.despesa_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY despesa_categorias_read ON public.despesa_categorias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY despesa_categorias_insert_admin ON public.despesa_categorias
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesa_categorias_update_admin ON public.despesa_categorias
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesa_categorias_delete_admin ON public.despesa_categorias
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY despesa_recorrentes_read ON public.despesa_recorrentes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY despesa_recorrentes_insert_admin ON public.despesa_recorrentes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesa_recorrentes_update_admin ON public.despesa_recorrentes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesa_recorrentes_delete_admin ON public.despesa_recorrentes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY despesas_read ON public.despesas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY despesas_insert_admin ON public.despesas
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesas_update_admin ON public.despesas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY despesas_delete_admin ON public.despesas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_despesa_recorrentes_set_updated_at
  BEFORE UPDATE ON public.despesa_recorrentes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_despesas_set_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
