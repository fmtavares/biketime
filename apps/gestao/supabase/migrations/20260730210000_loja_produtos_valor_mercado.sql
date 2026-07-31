-- Expõe valor de mercado no catálogo público de produtos para exibir "de/por" e % de desconto.
-- Coluna adicionada ao final para compatibilidade com CREATE OR REPLACE VIEW.
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
  AND p.visivel_ecommerce = true;

COMMENT ON VIEW public.loja_produtos IS 'Catálogo público de acessórios do showroom (/loja).';

GRANT SELECT ON public.loja_produtos TO anon, authenticated;
