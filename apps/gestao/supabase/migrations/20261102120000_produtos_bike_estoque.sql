-- Cada bike de venda ganha uma linha em produtos.
-- A ficha (série, custos, status, QR) continua em bikes_estoque.

INSERT INTO public.produto_categorias (nome, slug, ordem)
VALUES ('Bikes', 'bikes', 5)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS bike_estoque_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produtos_bike_estoque_id_key'
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_bike_estoque_id_key UNIQUE (bike_estoque_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produtos_bike_estoque_id_fkey'
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_bike_estoque_id_fkey
      FOREIGN KEY (bike_estoque_id) REFERENCES public.bikes_estoque(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN public.produtos.bike_estoque_id IS
  'Quando preenchido, a linha é o espelho de uma bike de venda. Nulo em acessórios.';

/**
 * Espelha a bike em produtos: nome, marca, preço, estoque 0/1, showroom e foto de vitrine.
 * Estoque 1 nos status ainda na loja; 0 quando vendida.
 * A ficha em bikes_estoque permanece a fonte desses valores.
 */
CREATE OR REPLACE FUNCTION public.sync_produto_da_bike()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cat_id uuid;
  nome_bike text;
  estoque numeric;
  foto text;
BEGIN
  SELECT id INTO cat_id
  FROM public.produto_categorias
  WHERE slug = 'bikes'
  LIMIT 1;

  nome_bike := btrim(concat_ws(' ', NULLIF(btrim(NEW.marca), ''), NULLIF(btrim(NEW.modelo), '')));
  IF nome_bike = '' THEN
    nome_bike := 'Bike';
  END IF;

  IF NEW.status IN ('em_estoque', 'reservada', 'em_montagem', 'em_transito', 'consignada') THEN
    estoque := 1;
  ELSE
    estoque := 0;
  END IF;

  foto := COALESCE(NULLIF(btrim(NEW.foto_completa), ''), NEW.fotos[1]);

  INSERT INTO public.produtos (
    bike_estoque_id,
    nome,
    marca,
    modelo,
    sku,
    categoria,
    categoria_id,
    preco_venda,
    valor_mercado,
    valor_minimo,
    estoque_atual,
    visivel_ecommerce,
    fotos,
    ativo,
    unidade,
    created_by
  ) VALUES (
    NEW.id,
    nome_bike,
    NULLIF(btrim(NEW.marca), ''),
    NULLIF(btrim(NEW.modelo), ''),
    NULLIF(btrim(COALESCE(NEW.sku, '')), ''),
    'Bikes',
    cat_id,
    COALESCE(NEW.valor_proposto, 0),
    NEW.valor_mercado,
    NEW.valor_minimo,
    estoque,
    COALESCE(NEW.visivel_ecommerce, false),
    CASE WHEN foto IS NULL THEN '{}'::text[] ELSE ARRAY[foto] END,
    true,
    'UN',
    NEW.created_by
  )
  ON CONFLICT (bike_estoque_id) DO UPDATE SET
    nome = EXCLUDED.nome,
    marca = EXCLUDED.marca,
    modelo = EXCLUDED.modelo,
    sku = EXCLUDED.sku,
    categoria = EXCLUDED.categoria,
    categoria_id = EXCLUDED.categoria_id,
    preco_venda = EXCLUDED.preco_venda,
    valor_mercado = EXCLUDED.valor_mercado,
    valor_minimo = EXCLUDED.valor_minimo,
    estoque_atual = EXCLUDED.estoque_atual,
    visivel_ecommerce = EXCLUDED.visivel_ecommerce,
    fotos = EXCLUDED.fotos,
    ativo = true;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_produto_da_bike() IS
  'Mantém a linha de produtos vinculada à bike de venda. Excluir a bike remove o produto (ON DELETE CASCADE).';

DROP TRIGGER IF EXISTS trg_sync_produto_da_bike ON public.bikes_estoque;
CREATE TRIGGER trg_sync_produto_da_bike
  AFTER INSERT OR UPDATE ON public.bikes_estoque
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_produto_da_bike();

-- Backfill sem alterar updated_at das bikes.
ALTER TABLE public.bikes_estoque DISABLE TRIGGER trg_bikes_estoque_updated;
UPDATE public.bikes_estoque SET marca = marca;
ALTER TABLE public.bikes_estoque ENABLE TRIGGER trg_bikes_estoque_updated;

-- Showroom de acessórios não repete a bike: o card continua em loja_bikes.
CREATE OR REPLACE VIEW public.loja_produtos AS
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
  p.observacoes,
  p.valor_mercado
FROM public.produtos p
LEFT JOIN public.produto_categorias c ON c.id = p.categoria_id
LEFT JOIN public.produto_marcas m ON m.id = p.marca_id
WHERE p.ativo = true
  AND p.visivel_ecommerce = true
  AND p.bike_estoque_id IS NULL;

COMMENT ON VIEW public.loja_produtos IS
  'Catálogo público de acessórios do showroom (/loja). Bikes ficam em loja_bikes.';

GRANT SELECT ON public.loja_produtos TO anon, authenticated;
