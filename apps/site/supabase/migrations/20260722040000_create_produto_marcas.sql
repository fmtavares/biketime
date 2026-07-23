-- Marcas dinâmicas de produtos/acessórios
CREATE TABLE public.produto_marcas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_produto_marcas_ordem ON public.produto_marcas (ordem, nome);

ALTER TABLE public.produto_marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY produto_marcas_read
  ON public.produto_marcas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY produto_marcas_insert_admin
  ON public.produto_marcas
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_marcas_update_admin
  ON public.produto_marcas
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY produto_marcas_delete_admin
  ON public.produto_marcas
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.produto_marcas (nome, slug, ordem) VALUES
  ('Giro', 'giro', 10),
  ('Oakley', 'oakley', 20),
  ('Shimano', 'shimano', 30),
  ('Specialized', 'specialized', 40),
  ('Absolute', 'absolute', 50),
  ('High One', 'high-one', 60),
  ('Outra', 'outra', 99)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS marca_id uuid REFERENCES public.produto_marcas(id);

CREATE INDEX IF NOT EXISTS idx_produtos_marca_id ON public.produtos (marca_id);

-- Backfill a partir do texto legado + cria marcas faltantes
INSERT INTO public.produto_marcas (nome, slug, ordem)
SELECT DISTINCT
  trim(p.marca) AS nome,
  lower(regexp_replace(
    regexp_replace(
      translate(lower(trim(p.marca)), 'áàâãäéèêëíìîïóòôõöúùûüçñ',
                                     'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-|-$)', '', 'g'
  )) AS slug,
  80
FROM public.produtos p
WHERE p.marca IS NOT NULL
  AND trim(p.marca) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.produto_marcas m
    WHERE lower(m.nome) = lower(trim(p.marca))
  )
ON CONFLICT (nome) DO NOTHING;

UPDATE public.produtos p
SET marca_id = m.id,
    marca = m.nome
FROM public.produto_marcas m
WHERE p.marca_id IS NULL
  AND p.marca IS NOT NULL
  AND lower(trim(p.marca)) = lower(m.nome);

-- View do showroom: join marca (mantém texto marca)
DROP VIEW IF EXISTS public.loja_produtos;
CREATE VIEW public.loja_produtos AS
SELECT
  p.id,
  p.nome,
  COALESCE(m.nome, p.marca) AS marca,
  p.modelo,
  c.nome AS categoria,
  c.slug AS categoria_slug,
  p.descricao,
  p.preco_venda,
  p.fotos,
  p.observacoes
FROM public.produtos p
LEFT JOIN public.produto_categorias c ON c.id = p.categoria_id
LEFT JOIN public.produto_marcas m ON m.id = p.marca_id
WHERE p.ativo = true
  AND p.visivel_ecommerce = true;

COMMENT ON VIEW public.loja_produtos IS 'Catálogo público de acessórios do showroom (/loja).';

GRANT SELECT ON public.loja_produtos TO anon, authenticated;
