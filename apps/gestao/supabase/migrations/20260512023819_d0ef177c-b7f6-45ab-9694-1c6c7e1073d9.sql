ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS quem_puxou text,
  ADD COLUMN IF NOT EXISTS responsavel_execucao text;