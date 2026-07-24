CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  nome_fantasia text,
  cnpj text,
  contato text,
  telefone text,
  email text,
  cidade text,
  estado text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fornecedores_nome ON public.fornecedores (nome);
CREATE INDEX idx_fornecedores_cnpj ON public.fornecedores (cnpj);
CREATE INDEX idx_fornecedores_ativo ON public.fornecedores (ativo);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY fornecedores_read
  ON public.fornecedores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY fornecedores_insert_admin
  ON public.fornecedores
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY fornecedores_update_admin
  ON public.fornecedores
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY fornecedores_delete_admin
  ON public.fornecedores
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_fornecedores_set_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
