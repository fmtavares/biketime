-- Campos da reforma (layout 2 IBS/CBS) exigidos pela Focus para NFS-e em São Paulo.

ALTER TABLE public.nfse_settings
  ADD COLUMN IF NOT EXISTS codigo_nbs text,
  ADD COLUMN IF NOT EXISTS codigo_indicador_operacao text,
  ADD COLUMN IF NOT EXISTS ibs_cbs_classificacao_tributaria text,
  ADD COLUMN IF NOT EXISTS consumidor_final smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exigibilidade_suspensa smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finalidade_emissao smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indicador_destinatario smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.nfse_settings.codigo_nbs IS
  'NBS (reforma). Confirmar com contador; Focus SP exige no layout 2.';
COMMENT ON COLUMN public.nfse_settings.item_lista_servico IS
  'Em SP a Focus costuma usar código municipal (ex.: 07498), não só 14.01.';
