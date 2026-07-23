-- Categorias dinâmicas de bikes (estoque/showroom)
CREATE TABLE public.bike_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bike_categorias_ordem ON public.bike_categorias (ordem, nome);

ALTER TABLE public.bike_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY bike_categorias_read
  ON public.bike_categorias
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY bike_categorias_insert_admin
  ON public.bike_categorias
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY bike_categorias_update_admin
  ON public.bike_categorias
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY bike_categorias_delete_admin
  ON public.bike_categorias
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.bike_categorias (nome, slug, ordem) VALUES
  ('Road', 'road', 10),
  ('MTB', 'mtb', 20),
  ('Trail', 'trail', 30),
  ('Gravel', 'gravel', 40),
  ('Triathlon', 'triathlon', 50),
  ('Urbana', 'urbana', 60)
ON CONFLICT (nome) DO NOTHING;

-- Importa categorias já usadas no estoque
INSERT INTO public.bike_categorias (nome, slug, ordem)
SELECT DISTINCT
  trim(b.categoria) AS nome,
  lower(regexp_replace(
    regexp_replace(
      translate(lower(trim(b.categoria)), 'áàâãäéèêëíìîïóòôõöúùûüçñ',
                                         'aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+', '-', 'g'
    ),
    '(^-|-$)', '', 'g'
  )) AS slug,
  80
FROM public.bikes_estoque b
WHERE b.categoria IS NOT NULL
  AND trim(b.categoria) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.bike_categorias c
    WHERE lower(c.nome) = lower(trim(b.categoria))
       OR c.slug = lower(regexp_replace(
            regexp_replace(
              translate(lower(trim(b.categoria)), 'áàâãäéèêëíìîïóòôõöúùûüçñ',
                                                 'aaaaaeeeeiiiiooooouuuucn'),
              '[^a-z0-9]+', '-', 'g'
            ),
            '(^-|-$)', '', 'g'
          ))
  )
ON CONFLICT (nome) DO NOTHING;
