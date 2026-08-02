-- Sequence ficou atrás dos códigos importados (ex.: last_value=4, max=SRV-0031),
-- causando duplicate key em novos inserts na tabela de preços.
SELECT setval(
  'public.servicos_precos_codigo_seq',
  GREATEST(
    1,
    COALESCE(
      (SELECT MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int)
       FROM public.servicos_precos),
      1
    )
  ),
  true
);
