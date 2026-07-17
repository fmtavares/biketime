
CREATE SEQUENCE IF NOT EXISTS public.servicos_precos_codigo_seq START 1;

ALTER TABLE public.servicos_precos
  ADD COLUMN IF NOT EXISTS codigo TEXT;

UPDATE public.servicos_precos
SET codigo = 'SRV-' || LPAD(nextval('public.servicos_precos_codigo_seq')::text, 4, '0')
WHERE codigo IS NULL;

ALTER TABLE public.servicos_precos
  ALTER COLUMN codigo SET DEFAULT ('SRV-' || LPAD(nextval('public.servicos_precos_codigo_seq')::text, 4, '0'));

ALTER TABLE public.servicos_precos
  ALTER COLUMN codigo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS servicos_precos_codigo_key ON public.servicos_precos(codigo);
