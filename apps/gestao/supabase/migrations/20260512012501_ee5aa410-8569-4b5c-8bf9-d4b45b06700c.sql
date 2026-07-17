ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS responsavel_avaliacao text,
ADD COLUMN IF NOT EXISTS data_avaliacao timestamp with time zone;