-- Categorias dinâmicas de produtos/acessórios
CREATE TABLE public.produto_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_produto_categorias_ordem ON public.produto_categorias (ordem, nome);

ALTER TABLE public.produto_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY produto_categorias_read
  ON public.produto_categorias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY produto_categorias_insert_admin
  ON public.produto_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_categorias_update_admin
  ON public.produto_categorias
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_categorias_delete_admin
  ON public.produto_categorias
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.produto_categorias (nome, slug, ordem) VALUES
  ('Capacete', 'capacete', 10),
  ('Óculos', 'oculos', 20),
  ('Sapatilha', 'sapatilha', 30),
  ('Outro', 'outro', 99)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.produto_categorias(id);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON public.produtos (categoria_id);

-- Backfill a partir do texto legado
UPDATE public.produtos p
SET categoria_id = c.id,
    categoria = c.nome
FROM public.produto_categorias c
WHERE p.categoria_id IS NULL
  AND p.categoria IS NOT NULL
  AND (
    lower(trim(p.categoria)) = lower(c.nome)
    OR (
      lower(translate(trim(p.categoria), 'Óó', 'Oo')) = 'oculos'
      AND c.slug = 'oculos'
    )
  );

-- Showroom: join com categoria (nome + slug)
DROP VIEW IF EXISTS public.loja_produtos;
CREATE VIEW public.loja_produtos AS
SELECT
  p.id,
  p.nome,
  p.marca,
  p.modelo,
  c.nome AS categoria,
  c.slug AS categoria_slug,
  p.descricao,
  p.preco_venda,
  p.fotos,
  p.observacoes
FROM public.produtos p
LEFT JOIN public.produto_categorias c ON c.id = p.categoria_id
WHERE p.ativo = true
  AND p.visivel_ecommerce = true;

COMMENT ON VIEW public.loja_produtos IS 'Catálogo público de acessórios do showroom (/loja).';

GRANT SELECT ON public.loja_produtos TO anon, authenticated;
