-- A leitura anônima dos tamanhos consultava produtos, e o visitante
-- não tem SELECT nessa tabela. A função responde só se o acessório
-- está na vitrine, para o showroom listar os tamanhos.

CREATE OR REPLACE FUNCTION public.produto_no_showroom(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.produtos p
    WHERE p.id = p_id
      AND p.ativo
      AND p.visivel_ecommerce
      AND p.bike_estoque_id IS NULL
  );
$$;

COMMENT ON FUNCTION public.produto_no_showroom(uuid) IS
  'Diz se o acessório entra no showroom. Usada na leitura pública dos tamanhos.';

REVOKE ALL ON FUNCTION public.produto_no_showroom(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produto_no_showroom(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS produto_variantes_read_anon_showroom ON public.produto_variantes;
CREATE POLICY produto_variantes_read_anon_showroom
  ON public.produto_variantes
  FOR SELECT
  TO anon
  USING (ativo AND public.produto_no_showroom(produto_id));
