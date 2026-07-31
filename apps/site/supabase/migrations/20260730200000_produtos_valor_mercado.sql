-- Valor de mercado de referência no cadastro de produtos (gestão).
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS valor_mercado numeric;
