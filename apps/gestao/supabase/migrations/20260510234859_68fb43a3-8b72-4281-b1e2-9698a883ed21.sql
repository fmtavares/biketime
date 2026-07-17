ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS pago_por text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS data_pagamento timestamptz;