
CREATE TABLE public.marcas_bikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marcas_bikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcas_read" ON public.marcas_bikes FOR SELECT TO authenticated USING (true);
CREATE POLICY "marcas_insert" ON public.marcas_bikes FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "marcas_update" ON public.marcas_bikes FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "marcas_delete" ON public.marcas_bikes FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

INSERT INTO public.marcas_bikes (nome) VALUES
  ('Caloi'), ('Cannondale'), ('Canyon'), ('Felt'), ('Scott'), ('Specialized'), ('Trek');
