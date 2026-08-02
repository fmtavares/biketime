-- NFS-e via Focus NFe: campos na OS + config do emitente (Bike Time / Pref. SP).

-- Status e links da última tentativa de emissão na ordem de serviço.
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS nfse_ref text,
  ADD COLUMN IF NOT EXISTS nfse_status text,
  ADD COLUMN IF NOT EXISTS nfse_numero text,
  ADD COLUMN IF NOT EXISTS nfse_codigo_verificacao text,
  ADD COLUMN IF NOT EXISTS nfse_url_pdf text,
  ADD COLUMN IF NOT EXISTS nfse_url_xml text,
  ADD COLUMN IF NOT EXISTS nfse_erro text,
  ADD COLUMN IF NOT EXISTS nfse_numero_rps text,
  ADD COLUMN IF NOT EXISTS nfse_emitida_em timestamptz;

COMMENT ON COLUMN public.ordens_servico.nfse_ref IS
  'Referência enviada à Focus NFe (idempotente por tentativa).';
COMMENT ON COLUMN public.ordens_servico.nfse_status IS
  'Status Focus: processando_autorizacao, autorizado, erro_autorizacao, etc.';
COMMENT ON COLUMN public.ordens_servico.nfse_url_pdf IS
  'URL do DANFSe/PDF retornado pela Focus para impressão.';

-- Configuração municipal do prestador (uma linha).
CREATE TABLE IF NOT EXISTS public.nfse_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL DEFAULT '',
  inscricao_municipal text NOT NULL DEFAULT '',
  codigo_municipio text NOT NULL DEFAULT '3550308',
  optante_simples_nacional boolean NOT NULL DEFAULT true,
  natureza_operacao text NOT NULL DEFAULT '1',
  regime_especial_tributacao text,
  item_lista_servico text NOT NULL DEFAULT '',
  codigo_tributario_municipio text,
  aliquota numeric(8, 4),
  discriminacao_padrao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nfse_settings IS
  'Dados do prestador para emissão de NFS-e (Focus NFe / Pref. SP). Token fica em secrets.';

ALTER TABLE public.nfse_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nfse_settings_read ON public.nfse_settings;
CREATE POLICY nfse_settings_read ON public.nfse_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS nfse_settings_insert_admin ON public.nfse_settings;
CREATE POLICY nfse_settings_insert_admin ON public.nfse_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS nfse_settings_update_admin ON public.nfse_settings;
CREATE POLICY nfse_settings_update_admin ON public.nfse_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_nfse_settings_updated ON public.nfse_settings;
CREATE TRIGGER trg_nfse_settings_updated
  BEFORE UPDATE ON public.nfse_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.nfse_settings (
  cnpj,
  inscricao_municipal,
  codigo_municipio,
  optante_simples_nacional,
  natureza_operacao,
  item_lista_servico
)
SELECT '', '', '3550308', true, '1', ''
WHERE NOT EXISTS (SELECT 1 FROM public.nfse_settings LIMIT 1);
