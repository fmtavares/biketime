-- Grades de tamanho + variantes de produto (estoque por tamanho)

CREATE TABLE public.tamanho_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tamanho_grades_ordem ON public.tamanho_grades (ordem, nome);

CREATE TABLE public.tamanho_grade_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id uuid NOT NULL REFERENCES public.tamanho_grades(id) ON DELETE CASCADE,
  valor text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  UNIQUE (grade_id, valor)
);

CREATE INDEX idx_tamanho_grade_itens_grade ON public.tamanho_grade_itens (grade_id, ordem);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.tamanho_grades(id);

CREATE INDEX IF NOT EXISTS idx_produtos_grade_id ON public.produtos (grade_id);

CREATE TABLE public.produto_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  tamanho text NOT NULL,
  sku text,
  estoque numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, tamanho)
);

CREATE INDEX idx_produto_variantes_produto ON public.produto_variantes (produto_id);
CREATE INDEX idx_produto_variantes_ativo ON public.produto_variantes (produto_id, ativo);

CREATE TRIGGER trg_produto_variantes_set_updated_at
  BEFORE UPDATE ON public.produto_variantes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Recalcula estoque_atual do pai a partir das variantes ativas
CREATE OR REPLACE FUNCTION public.sync_produto_estoque_from_variantes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.produto_id, OLD.produto_id);
  UPDATE public.produtos p
  SET estoque_atual = COALESCE((
    SELECT SUM(v.estoque)
    FROM public.produto_variantes v
    WHERE v.produto_id = pid AND v.ativo = true
  ), 0)
  WHERE p.id = pid
    AND p.grade_id IS NOT NULL;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_produto_variantes_sync_estoque
  AFTER INSERT OR UPDATE OR DELETE ON public.produto_variantes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_produto_estoque_from_variantes();

-- Quando remove a grade, não zera estoque (mantém o valor atual)
-- Quando atribui grade sem variantes ainda, estoque fica até sync

ALTER TABLE public.tamanho_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tamanho_grade_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_variantes ENABLE ROW LEVEL SECURITY;

-- Grades: leitura autenticada + anon (showroom/forms); escrita admin
CREATE POLICY tamanho_grades_read
  ON public.tamanho_grades FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY tamanho_grades_admin_all
  ON public.tamanho_grades FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY tamanho_grade_itens_read
  ON public.tamanho_grade_itens FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY tamanho_grade_itens_admin_all
  ON public.tamanho_grade_itens FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Variantes: autenticados leem; admin escreve; anon só de produtos no showroom
CREATE POLICY produto_variantes_read_auth
  ON public.produto_variantes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY produto_variantes_read_anon_showroom
  ON public.produto_variantes FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.produtos p
      WHERE p.id = produto_id
        AND p.ativo = true
        AND p.visivel_ecommerce = true
    )
  );

CREATE POLICY produto_variantes_insert_admin
  ON public.produto_variantes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_variantes_update_admin
  ON public.produto_variantes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_variantes_delete_admin
  ON public.produto_variantes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.tamanho_grades TO anon, authenticated;
GRANT SELECT ON public.tamanho_grade_itens TO anon, authenticated;
GRANT SELECT ON public.produto_variantes TO anon, authenticated;

-- Seeds
INSERT INTO public.tamanho_grades (slug, nome, ordem) VALUES
  ('roupa', 'Roupa (PP–GG)', 10),
  ('sapatilha', 'Sapatilha (37–44)', 20),
  ('bike_cm', 'Bike quadro (cm)', 30),
  ('bike_letra', 'Bike (P/M/G)', 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tamanho_grade_itens (grade_id, valor, ordem)
SELECT g.id, v.valor, v.ordem
FROM public.tamanho_grades g
JOIN (
  VALUES
    ('roupa', 'PP', 10),
    ('roupa', 'P', 20),
    ('roupa', 'M', 30),
    ('roupa', 'G', 40),
    ('roupa', 'GG', 50),
    ('sapatilha', '37', 10),
    ('sapatilha', '38', 20),
    ('sapatilha', '39', 30),
    ('sapatilha', '40', 40),
    ('sapatilha', '41', 50),
    ('sapatilha', '42', 60),
    ('sapatilha', '43', 70),
    ('sapatilha', '44', 80),
    ('bike_cm', '44', 10),
    ('bike_cm', '46', 20),
    ('bike_cm', '48', 30),
    ('bike_cm', '50', 40),
    ('bike_cm', '52', 50),
    ('bike_cm', '54', 60),
    ('bike_cm', '56', 70),
    ('bike_letra', 'P', 10),
    ('bike_letra', 'M', 20),
    ('bike_letra', 'G', 30)
) AS v(slug, valor, ordem) ON v.slug = g.slug
ON CONFLICT (grade_id, valor) DO NOTHING;
