-- Agrupa Luz/Água/Telefone/Aluguel na categoria Operacionais

INSERT INTO public.despesa_categorias (nome, slug, ordem, ativo)
VALUES ('Operacionais', 'operacionais', 10, true)
ON CONFLICT (nome) DO UPDATE SET slug = EXCLUDED.slug, ordem = EXCLUDED.ordem, ativo = true;

UPDATE public.despesas d
SET categoria_id = o.id
FROM public.despesa_categorias o, public.despesa_categorias old
WHERE o.slug = 'operacionais'
  AND old.slug IN ('luz', 'agua', 'telefone-internet', 'aluguel')
  AND d.categoria_id = old.id;

UPDATE public.despesa_recorrentes r
SET categoria_id = o.id
FROM public.despesa_categorias o, public.despesa_categorias old
WHERE o.slug = 'operacionais'
  AND old.slug IN ('luz', 'agua', 'telefone-internet', 'aluguel')
  AND r.categoria_id = old.id;

UPDATE public.despesa_categorias
SET ativo = false
WHERE slug IN ('luz', 'agua', 'telefone-internet', 'aluguel');
