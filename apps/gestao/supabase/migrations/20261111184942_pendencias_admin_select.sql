-- Administrador enxerga pendências privadas dos demais para poder editá-las.
-- Sem SELECT, o UPDATE permitido ao admin não alcança a linha.

DROP POLICY IF EXISTS pendencias_select ON public.pendencias;

CREATE POLICY pendencias_select ON public.pendencias
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR privado = false
  OR created_by = auth.uid()
  OR responsavel_id = auth.uid()
);
