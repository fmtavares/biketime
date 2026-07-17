-- Status enum para bikes do estoque (vendas)
DO $$ BEGIN
  CREATE TYPE public.bike_estoque_status AS ENUM ('em_estoque','reservada','vendida','em_montagem','em_transito','consignada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabela de bikes do estoque (vendas) — separada da tabela 'bikes' (clientes da oficina)
CREATE TABLE public.bikes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE,
  numero_serie text,
  status public.bike_estoque_status NOT NULL DEFAULT 'em_estoque',
  data_entrada date NOT NULL DEFAULT current_date,
  fornecedor text,
  -- técnico
  marca text NOT NULL,
  modelo text NOT NULL,
  ano integer,
  categoria text,
  tamanho text,
  material_quadro text,
  peso numeric,
  cor text,
  -- componentes
  grupo text,
  modelo_grupo text,
  relacao text,
  freios text,
  rodas text,
  suspensao text,
  guidao text,
  canote text,
  pedivela text,
  pneus text,
  medidor_potencia text,
  acessorios text,
  -- condição
  condicao text,
  quilometragem numeric,
  historico_manutencao text,
  garantia text,
  observacoes_tecnicas text,
  -- financeiro
  custo_bike numeric NOT NULL DEFAULT 0,
  frete numeric NOT NULL DEFAULT 0,
  seguro numeric NOT NULL DEFAULT 0,
  montagem numeric NOT NULL DEFAULT 0,
  revisao_inicial numeric NOT NULL DEFAULT 0,
  custos_adicionais numeric NOT NULL DEFAULT 0,
  valor_minimo numeric,
  -- fotos
  foto_completa text,
  foto_cambio_frente text,
  foto_cambio_traseiro text,
  foto_freio text,
  foto_numero_serie text,
  fotos text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.bikes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bikes_estoque_read" ON public.bikes_estoque FOR SELECT TO authenticated USING (true);
CREATE POLICY "bikes_estoque_insert_admin" ON public.bikes_estoque FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bikes_estoque_update_admin" ON public.bikes_estoque FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "bikes_estoque_delete_admin" ON public.bikes_estoque FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_bikes_estoque_updated BEFORE UPDATE ON public.bikes_estoque FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Observações comerciais internas
CREATE TABLE public.bike_estoque_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_estoque_id uuid NOT NULL REFERENCES public.bikes_estoque(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bike_estoque_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_est_obs_read" ON public.bike_estoque_observations FOR SELECT TO authenticated USING (true);
CREATE POLICY "bike_est_obs_insert" ON public.bike_estoque_observations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bike_est_obs_update_recent" ON public.bike_estoque_observations FOR UPDATE TO authenticated USING (auth.uid() = user_id AND created_at > now() - interval '5 minutes');

CREATE TRIGGER trg_bike_est_obs_updated BEFORE UPDATE ON public.bike_estoque_observations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Configurações financeiras (singleton)
CREATE TABLE public.financial_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icms_pct numeric NOT NULL DEFAULT 12,
  imposto_venda_pct numeric NOT NULL DEFAULT 4,
  taxa_financeira_pct numeric NOT NULL DEFAULT 3,
  comissao_pct numeric NOT NULL DEFAULT 2,
  markup_pct numeric NOT NULL DEFAULT 35,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_settings_read" ON public.financial_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_settings_insert_admin" ON public.financial_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "fin_settings_update_admin" ON public.financial_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_fin_settings_updated BEFORE UPDATE ON public.financial_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.financial_settings (icms_pct, imposto_venda_pct, taxa_financeira_pct, comissao_pct, markup_pct)
VALUES (12, 4, 3, 2, 35);

-- Storage bucket para fotos de bikes do estoque
INSERT INTO storage.buckets (id, name, public)
VALUES ('bikes-estoque-photos', 'bikes-estoque-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bikes_estoque_photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'bikes-estoque-photos');
CREATE POLICY "bikes_estoque_photos_insert_admin" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bikes-estoque-photos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "bikes_estoque_photos_update_admin" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bikes-estoque-photos' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "bikes_estoque_photos_delete_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bikes-estoque-photos' AND public.has_role(auth.uid(),'admin'));