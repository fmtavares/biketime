-- Showroom público: só bikes elegíveis ao e-commerce, sem colunas financeiras sensíveis
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
  observacoes_tecnicas
FROM public.bikes_estoque
WHERE visivel_ecommerce = true
  AND status = 'em_estoque';

COMMENT ON VIEW public.loja_bikes IS 'Catálogo público do showroom (/loja). Filtra bikes_estoque elegíveis.';

GRANT SELECT ON public.loja_bikes TO anon, authenticated;
