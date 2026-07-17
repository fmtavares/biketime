CREATE TABLE public.pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atividade text NOT NULL,
  tipo_atividade text,
  data_prevista date,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  privado boolean NOT NULL DEFAULT false,
  concluida boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY pendencias_select ON public.pendencias FOR SELECT TO authenticated
USING (privado = false OR created_by = auth.uid() OR responsavel_id = auth.uid());

CREATE POLICY pendencias_insert ON public.pendencias FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY pendencias_update ON public.pendencias FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR responsavel_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR responsavel_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY pendencias_delete ON public.pendencias FOR DELETE TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER pendencias_set_updated_at
BEFORE UPDATE ON public.pendencias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_pendencias_responsavel ON public.pendencias(responsavel_id);
CREATE INDEX idx_pendencias_created_by ON public.pendencias(created_by);
CREATE INDEX idx_pendencias_data_prevista ON public.pendencias(data_prevista);