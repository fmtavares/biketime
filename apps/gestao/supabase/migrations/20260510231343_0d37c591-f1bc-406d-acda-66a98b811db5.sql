CREATE TABLE public.mecanicos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mecanicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY mecanicos_read ON public.mecanicos FOR SELECT TO authenticated USING (true);
CREATE POLICY mecanicos_insert ON public.mecanicos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY mecanicos_update ON public.mecanicos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY mecanicos_delete ON public.mecanicos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.mecanicos (nome) VALUES ('Andre'), ('Luciano (Pinguim)'), ('Wellington (Pizza)');