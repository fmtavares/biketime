CREATE TABLE IF NOT EXISTS public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY funcionarios_read ON public.funcionarios FOR SELECT TO authenticated USING (true);
CREATE POLICY funcionarios_insert ON public.funcionarios FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY funcionarios_update ON public.funcionarios FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY funcionarios_delete ON public.funcionarios FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));