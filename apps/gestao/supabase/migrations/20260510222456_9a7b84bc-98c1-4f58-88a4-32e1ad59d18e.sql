
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default vendedor role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT,
  telefone_secundario TEXT,
  email TEXT,
  cpf TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  data_nascimento DATE,
  instagram TEXT,
  vendedor_responsavel TEXT,
  vip BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  origem_lead TEXT, -- Instagram | Indicação | Loja | Site | Evento
  -- Perfil do ciclista
  modalidades TEXT[] DEFAULT '{}',
  nivel TEXT, -- Iniciante | Intermediário | Avançado
  frequencia TEXT, -- Diário | 2-3x semana | Fim de semana
  objetivo TEXT, -- Performance | Lazer | Competição | Saúde
  participa_provas BOOLEAN DEFAULT false,
  equipe TEXT,
  tamanho_bike TEXT,
  altura TEXT,
  marca_preferida TEXT,
  sonho_consumo TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_clientes_nome ON public.clientes (nome);
CREATE INDEX idx_clientes_whatsapp ON public.clientes (whatsapp);

-- ============ BIKES ============
CREATE TABLE public.bikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  ano INTEGER,
  cor TEXT,
  tamanho TEXT,
  numero_serie TEXT,
  data_compra DATE,
  valor_pago NUMERIC(12,2),
  onde_comprou TEXT,
  bike_atual BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'atual', -- atual | vendida
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_bikes_updated BEFORE UPDATE ON public.bikes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bikes_cliente ON public.bikes(cliente_id);
CREATE INDEX idx_bikes_modelo ON public.bikes(modelo);
CREATE INDEX idx_bikes_serie ON public.bikes(numero_serie);

-- ============ FOTOS ============
CREATE TABLE public.bike_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- Geral | Câmbio Dianteiro | Câmbio Traseiro | Suspensão | Canote | Guidão/Mesa
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fotos_bike ON public.bike_fotos(bike_id);

-- ============ HISTÓRICO TÉCNICO ============
CREATE TABLE public.historicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_os TEXT,
  tipo TEXT NOT NULL, -- Revisão | Upgrade | Troca de peça | Garantia | Acidente | Lavagem técnica
  descricao TEXT NOT NULL,
  km_horimetro TEXT,
  valor NUMERIC(12,2),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_bike ON public.historicos(bike_id);

-- ============ ORDENS DE SERVIÇO ============
CREATE SEQUENCE public.os_numero_seq START 1000;

CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT ('OS-' || nextval('public.os_numero_seq')::text),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  bike_id UUID NOT NULL REFERENCES public.bikes(id) ON DELETE RESTRICT,
  problema_relatado TEXT,
  checklist_entrada TEXT,
  mecanico TEXT,
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_prevista DATE,
  servicos_executados TEXT,
  pecas_utilizadas TEXT,
  valor_pecas NUMERIC(12,2) DEFAULT 0,
  valor_mao_obra NUMERIC(12,2) DEFAULT 0,
  observacoes_tecnicas TEXT,
  fotos_servico TEXT[] DEFAULT '{}',
  aprovado BOOLEAN,
  data_aprovacao TIMESTAMPTZ,
  valor_aprovado NUMERIC(12,2),
  data_conclusao TIMESTAMPTZ,
  data_entrega TIMESTAMPTZ,
  observacao_conclusao TEXT,
  proxima_revisao DATE,
  status TEXT NOT NULL DEFAULT 'fila', -- fila | avaliacao | aguardando_aprovacao | em_execucao | com_problemas | finalizada | entregue
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_os_updated BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_os_status ON public.ordens_servico(status);
CREATE INDEX idx_os_cliente ON public.ordens_servico(cliente_id);
CREATE INDEX idx_os_bike ON public.ordens_servico(bike_id);

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bike_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- profiles: usuário vê o seu, admin vê todos
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- user_roles: usuário vê suas roles; admin gerencia tudo
CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Workspace compartilhado: qualquer autenticado lê/insere/atualiza; só admin deleta
CREATE POLICY "clientes_read" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "bikes_read" ON public.bikes FOR SELECT TO authenticated USING (true);
CREATE POLICY "bikes_insert" ON public.bikes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bikes_update" ON public.bikes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bikes_delete" ON public.bikes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fotos_read" ON public.bike_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fotos_insert" ON public.bike_fotos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fotos_delete" ON public.bike_fotos FOR DELETE TO authenticated USING (true);

CREATE POLICY "hist_read" ON public.historicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "hist_insert" ON public.historicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "hist_update" ON public.historicos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hist_delete" ON public.historicos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "os_read" ON public.ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "os_insert" ON public.ordens_servico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "os_update" ON public.ordens_servico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "os_delete" ON public.ordens_servico FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('bike-fotos', 'bike-fotos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bike_fotos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'bike-fotos');
CREATE POLICY "bike_fotos_auth_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bike-fotos');
CREATE POLICY "bike_fotos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'bike-fotos');
CREATE POLICY "bike_fotos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bike-fotos');
