ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS responsavel_entrega text,
  ADD COLUMN IF NOT EXISTS responsavel_recebimento text;