
CREATE TABLE public.servicos_precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precos_read" ON public.servicos_precos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "precos_insert_admin" ON public.servicos_precos
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "precos_update_admin" ON public.servicos_precos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "precos_delete_admin" ON public.servicos_precos
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_servicos_precos_updated_at
  BEFORE UPDATE ON public.servicos_precos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
