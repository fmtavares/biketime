
CREATE TABLE public.tipo_atividade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipo_atividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipo_atividade_read ON public.tipo_atividade FOR SELECT TO authenticated USING (true);
CREATE POLICY tipo_atividade_insert_admin ON public.tipo_atividade FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tipo_atividade_update_admin ON public.tipo_atividade FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY tipo_atividade_delete_admin ON public.tipo_atividade FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.tipo_atividade (nome) VALUES
  ('Ajuste App'),
  ('Compra'),
  ('Melhoria Loja'),
  ('Tarefa')
ON CONFLICT (nome) DO NOTHING;
