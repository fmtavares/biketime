ALTER TABLE public.bikes_estoque
  ADD COLUMN IF NOT EXISTS override_icms_pct numeric,
  ADD COLUMN IF NOT EXISTS override_imposto_venda_pct numeric,
  ADD COLUMN IF NOT EXISTS override_taxa_financeira_pct numeric,
  ADD COLUMN IF NOT EXISTS override_comissao_pct numeric,
  ADD COLUMN IF NOT EXISTS override_markup_pct numeric;