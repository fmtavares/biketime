-- Expõe valor de mercado no catálogo público para exibir "de/por" e % de desconto.
-- Coluna adicionada ao final para compatibilidade com CREATE OR REPLACE VIEW.
CREATE OR REPLACE VIEW public.loja_bikes AS
SELECT
  id,
  marca,
  modelo,
  ano,
  tamanho,
  cor,
  categoria,
  condicao,
  valor_proposto,
  foto_completa,
  observacoes_tecnicas,
  valor_mercado
FROM public.bikes_estoque
WHERE visivel_ecommerce = true
  AND status = 'em_estoque';

COMMENT ON VIEW public.loja_bikes IS 'Catálogo público do showroom (/loja). Filtra bikes_estoque elegíveis.';

GRANT SELECT ON public.loja_bikes TO anon, authenticated;
