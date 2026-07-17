ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS apto text;