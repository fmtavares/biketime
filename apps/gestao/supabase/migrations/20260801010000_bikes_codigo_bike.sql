-- Código curto da bike para adesivo/QR (identifica bike e, via cliente_id, o dono).
CREATE SEQUENCE IF NOT EXISTS public.bikes_codigo_seq START 1;

ALTER TABLE public.bikes
  ADD COLUMN IF NOT EXISTS codigo_bike text;

UPDATE public.bikes
SET codigo_bike = 'BTB-' || LPAD(nextval('public.bikes_codigo_seq')::text, 5, '0')
WHERE codigo_bike IS NULL;

SELECT setval(
  'public.bikes_codigo_seq',
  GREATEST(
    1,
    COALESCE(
      (SELECT MAX(NULLIF(regexp_replace(codigo_bike, '\D', '', 'g'), '')::int)
       FROM public.bikes),
      1
    )
  ),
  true
);

ALTER TABLE public.bikes
  ALTER COLUMN codigo_bike SET DEFAULT ('BTB-' || LPAD(nextval('public.bikes_codigo_seq')::text, 5, '0'));

ALTER TABLE public.bikes
  ALTER COLUMN codigo_bike SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bikes_codigo_bike_key ON public.bikes (codigo_bike);

COMMENT ON COLUMN public.bikes.codigo_bike IS 'Código impresso no adesivo/QR (ex.: BTB-00001).';
